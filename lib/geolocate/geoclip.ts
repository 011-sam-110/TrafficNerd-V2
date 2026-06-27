// GeoCLIP geolocation backend — the picarta-grade upgrade (drop-in, dormant).
//
// Talks to a small Python sidecar (scripts/geolocate_service.py) that runs the
// GeoCLIP geo-embedding model and returns top-k (lat, lon, confidence) directly.
// Enable with  GEOLOCATE_BACKEND=geoclip  +  GEOLOCATE_GEOCLIP_URL=http://127.0.0.1:8088
// When the sidecar isn't running this stays dormant: a clear message, never a crash.
//
// The sidecar has no place names (a geo-embedding model only knows coordinates),
// so the route reverse-geocodes each hit through Photon for a human label.

import { geoclipConfig, BackendNotConfiguredError } from "./config";
import { normalizeGeoclip } from "./normalize";
import { type ImageInput } from "./image";
import type { RawCandidate } from "./types";

/** POST the image to the GeoCLIP sidecar and return ranked coordinate candidates
 *  (place names left blank — the route reverse-geocodes them). */
export async function locateWithGeoclip(img: ImageInput, limit = 5): Promise<RawCandidate[]> {
  const cfg = geoclipConfig();
  if (!cfg) {
    throw new BackendNotConfiguredError(
      "The GeoCLIP backend is selected but its sidecar URL is unset. Set GEOLOCATE_GEOCLIP_URL " +
        "(and run scripts/geolocate_service.py) to enable it.",
    );
  }

  const payload =
    img.kind === "url"
      ? { image_url: img.url, top_k: limit }
      : { image_base64: img.base64, top_k: limit };

  let res: Response;
  try {
    res = await fetch(`${cfg.url}/geolocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new BackendNotConfiguredError(
      "The GeoCLIP sidecar is unreachable. Start scripts/geolocate_service.py, or switch to " +
        "the vision-AI backend (unset GEOLOCATE_BACKEND).",
    );
  }
  if (!res.ok) {
    throw new Error(`The GeoCLIP sidecar returned an error (${res.status}).`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("The GeoCLIP sidecar returned a malformed response.");
  }
  return normalizeGeoclip(json, { limit });
}
