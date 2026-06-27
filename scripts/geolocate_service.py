#!/usr/bin/env python3
"""
GeoCLIP geolocation sidecar — the picarta-grade backend for /api/geolocate.

A tiny FastAPI service that runs the open GeoCLIP geo-embedding model (the real
deal: it returns top-k GPS coordinates + confidence directly from a photo, no API
key). The Next.js route (app/api/geolocate/route.ts) calls this over localhost when
GEOLOCATE_BACKEND=geoclip. It is OPTIONAL: with no sidecar running, the route falls
back to the always-on vision-AI backend.

────────────────────────────────────────────────────────────────────────────────
RUN IT
  python -m venv .venv && . .venv/bin/activate        (Windows: .venv\\Scripts\\activate)
  pip install fastapi uvicorn pillow torch geoclip
  python scripts/geolocate_service.py                 # serves on 127.0.0.1:8088

Then point the web app at it:
  GEOLOCATE_BACKEND=geoclip
  GEOLOCATE_GEOCLIP_URL=http://127.0.0.1:8088

First request downloads the GeoCLIP weights (~hundreds of MB) and the gallery of
candidate GPS coordinates; subsequent requests are fast. GPU is used automatically
if torch sees CUDA.

DEPLOY NOTE: keep this service private (bind 127.0.0.1, or behind the app's network).
It does no auth — it is meant to sit beside the Next.js server, not on the public net.
────────────────────────────────────────────────────────────────────────────────

CONTRACT (must match lib/geolocate/geoclip.ts):
  POST /geolocate
    { "image_base64": "<base64, optionally a data: URL>", "top_k": 5 }
    or
    { "image_url": "https://...", "top_k": 5 }
  ->  { "predictions": [ { "lat": <float>, "lon": <float>, "confidence": <0..1> }, ... ] }

  GET  /health  -> { "status": "ok", "model_loaded": <bool> }
"""

from __future__ import annotations

import base64
import io
import os
import re
import tempfile

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:  # heavy deps are imported lazily / guarded so the file at least imports.
    import requests  # noqa: F401  (only used for image_url)
except Exception:  # pragma: no cover
    requests = None

app = FastAPI(title="TrafficNerd GeoCLIP sidecar", version="1.0")

_MODEL = None
_DATA_URL_RE = re.compile(r"^data:image/[a-z0-9.+-]+;base64,", re.IGNORECASE)


def _get_model():
    """Lazy-load GeoCLIP once (heavy). Raises a clear error if it isn't installed."""
    global _MODEL
    if _MODEL is None:
        from geoclip import GeoCLIP  # type: ignore

        _MODEL = GeoCLIP()
    return _MODEL


class GeolocateRequest(BaseModel):
    image_base64: str | None = None
    image_url: str | None = None
    top_k: int = 5


def _load_image_to_tempfile(req: GeolocateRequest) -> str:
    """GeoCLIP.predict() wants a file path, so materialise the input to a temp file."""
    from PIL import Image  # type: ignore

    if req.image_base64:
        b64 = _DATA_URL_RE.sub("", req.image_base64.strip())
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    elif req.image_url:
        if requests is None:
            raise HTTPException(500, "install 'requests' to use image_url")
        resp = requests.get(req.image_url, timeout=15)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    else:
        raise HTTPException(400, "provide image_base64 or image_url")

    fd, path = tempfile.mkstemp(suffix=".jpg")
    os.close(fd)
    img.save(path, format="JPEG", quality=92)
    return path


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": _MODEL is not None}


@app.post("/geolocate")
def geolocate(req: GeolocateRequest) -> dict:
    top_k = max(1, min(int(req.top_k or 5), 10))
    path = _load_image_to_tempfile(req)
    try:
        model = _get_model()
        # GeoCLIP returns (top_pred_gps, top_pred_prob) for the top_k candidates.
        gps, probs = model.predict(path, top_k=top_k)
    except HTTPException:
        raise
    except Exception as exc:  # surface a clean 500 (route maps it to a JSON error)
        raise HTTPException(500, f"GeoCLIP inference failed: {exc}") from exc
    finally:
        try:
            os.remove(path)
        except OSError:
            pass

    predictions = []
    for i in range(len(gps)):
        lat, lon = float(gps[i][0]), float(gps[i][1])
        conf = float(probs[i]) if i < len(probs) else 0.0
        predictions.append({"lat": lat, "lon": lon, "confidence": conf})
    return {"predictions": predictions}


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("GEOCLIP_HOST", "127.0.0.1")
    port = int(os.environ.get("GEOCLIP_PORT", "8088"))
    uvicorn.run(app, host=host, port=port)
