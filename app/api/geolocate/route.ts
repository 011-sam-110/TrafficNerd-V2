import type { NextRequest } from "next/server";
import { normalizePhoton } from "@/lib/geo/geocode";
import {
  selectedBackend,
  backendOrder,
  methodLabel,
  BackendNotConfiguredError,
  MAX_IMAGE_BYTES,
} from "@/lib/geolocate/config";
import {
  imageFromBytes,
  imageFromBase64,
  base64ByteLength,
  type ImageInput,
} from "@/lib/geolocate/image";
import { isValidCoord } from "@/lib/geolocate/normalize";
import { locateWithLlm } from "@/lib/geolocate/llm";
import { locateWithGeoclip } from "@/lib/geolocate/geoclip";
import type { GeolocateResponse, RawCandidate, ResolvedCandidate } from "@/lib/geolocate/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needs Buffer (base64) — not the edge runtime.

const PHOTON_REVERSE = "https://photon.komoot.io/reverse";
const UA = "TrafficNerd/2.0 (+https://github.com/011-sam-110/TrafficNerd-V2)";
const NOTE =
  "Estimated location — an informed guess from visual cues, not a GPS measurement. " +
  "Confidence is the model's own self-estimate.";

/**
 * POST /api/geolocate — keyless photo geolocation (a "picarta.ai" equivalent).
 *
 * Accepts an image as multipart (`image` File and/or `imageUrl` field), or JSON
 * ({ imageBase64 } | { imageUrl }). Runs the configured backend (vision-AI by
 * default, GeoCLIP sidecar when GEOLOCATE_BACKEND=geoclip), resolves each hit to
 * real coordinates + a place label, and returns ranked candidates. Dormant-safe:
 * an unconfigured/unreachable backend returns a clear message, never a 5xx crash.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const method = methodLabel(selectedBackend()); // for early-exit error responses

  // ---- 1. Parse + size-limit the upload ------------------------------------
  let image: ImageInput;
  try {
    const parsed = await readImage(req);
    if ("error" in parsed) return json({ candidates: [], method, error: parsed.error }, parsed.status);
    image = parsed.image;
  } catch {
    return json({ candidates: [], method, error: "Could not read the uploaded image." }, 400);
  }

  // ---- 2. Run the preferred backend, falling back if it's dormant ----------
  // GeoCLIP first (best accuracy) → vision-AI if its sidecar isn't running, or
  // vice-versa when GEOLOCATE_BACKEND=llm. Only a *dormant* backend (missing
  // config / unreachable sidecar) triggers the fallback; a genuine upstream
  // failure surfaces as 502.
  let raw: RawCandidate[] | null = null;
  let usedMethod = method;
  let lastDormant: BackendNotConfiguredError | null = null;
  for (const b of backendOrder()) {
    try {
      raw = b === "geoclip" ? await locateWithGeoclip(image) : await locateWithLlm(image);
      usedMethod = methodLabel(b);
      break;
    } catch (e) {
      if (e instanceof BackendNotConfiguredError) {
        lastDormant = e; // this backend is dormant — try the next one
        continue;
      }
      const msg = e instanceof Error ? e.message : "The geolocation backend failed.";
      return json({ candidates: [], method: methodLabel(b), error: msg }, 502);
    }
  }
  if (raw === null) {
    // Every backend is dormant → 503 with the most relevant actionable message.
    return json(
      { candidates: [], method, error: lastDormant?.message ?? "No geolocation backend is configured." },
      503,
    );
  }

  // ---- 3. Resolve coordinates + place labels -------------------------------
  const origin = req.nextUrl.origin;
  const resolved = (await Promise.all(raw.map((c) => resolveCandidate(c, origin)))).filter(
    (c): c is ResolvedCandidate => c !== null,
  );

  if (resolved.length === 0) {
    return json(
      { candidates: [], method: usedMethod, note: NOTE, error: "No location could be estimated from this image." },
      200,
    );
  }
  return json({ candidates: resolved, method: usedMethod, note: NOTE }, 200);
}

// ---------------------------------------------------------------------------

type ReadResult = { image: ImageInput } | { error: string; status: number };

async function readImage(req: NextRequest): Promise<ReadResult> {
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    const url = form.get("imageUrl");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMAGE_BYTES) return tooLarge();
      const bytes = await file.arrayBuffer();
      return { image: imageFromBytes(bytes, file.type || "image/jpeg") };
    }
    if (typeof url === "string" && isHttpUrl(url)) return { image: { kind: "url", url } };
    return { error: "Provide an image file or an image URL.", status: 400 };
  }

  // JSON body: { imageBase64 } | { imageUrl }.
  let body: { imageBase64?: unknown; imageUrl?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return { error: "Expected multipart form-data or a JSON body.", status: 400 };
  }
  if (typeof body.imageBase64 === "string" && body.imageBase64.trim()) {
    if (base64ByteLength(body.imageBase64) > MAX_IMAGE_BYTES) return tooLarge();
    const img = imageFromBase64(body.imageBase64);
    if (!img) return { error: "imageBase64 is not valid base64 image data.", status: 400 };
    return { image: img };
  }
  if (typeof body.imageUrl === "string" && isHttpUrl(body.imageUrl)) {
    return { image: { kind: "url", url: body.imageUrl } };
  }
  return { error: "Provide imageBase64 or imageUrl.", status: 400 };
}

function tooLarge(): ReadResult {
  return { error: `Image exceeds the ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB limit.`, status: 413 };
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Fill in real coords (forward-geocode a named place) and/or a label
 *  (reverse-geocode bare coords). Returns null when a candidate can't be placed. */
async function resolveCandidate(c: RawCandidate, origin: string): Promise<ResolvedCandidate | null> {
  // Has valid coords already (LLM gave them, or GeoCLIP). Ensure it has a label.
  if (c.lat !== null && c.lon !== null && isValidCoord(c.lat, c.lon)) {
    let place = c.place;
    let country = c.country;
    if (!place) {
      const rev = await reverseGeocode(c.lat, c.lon);
      place = rev?.name ?? `Near ${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`;
      country = country ?? rev?.country;
    }
    return { place, country, lat: c.lat, lon: c.lon, confidence: c.confidence, reasoning: c.reasoning };
  }

  // No coords but a place name → forward-geocode through the existing /api/geocode.
  if (c.place) {
    const hit = await forwardGeocode(origin, c.place);
    if (hit) {
      return {
        place: c.place,
        country: c.country ?? hit.country,
        lat: hit.lat,
        lon: hit.lon,
        confidence: c.confidence,
        reasoning: c.reasoning,
      };
    }
  }
  return null; // can't place it on the map — drop it.
}

/** Reuse the existing keyless geocoder route (Photon, server-cached). */
async function forwardGeocode(
  origin: string,
  place: string,
): Promise<{ lat: number; lon: number; country?: string } | null> {
  try {
    const res = await fetch(`${origin}/api/geocode?q=${encodeURIComponent(place)}&limit=1`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const { results } = (await res.json()) as { results?: Array<{ lat: number; lon: number; name: string }> };
    const top = results?.[0];
    if (!top) return null;
    return { lat: top.lat, lon: top.lon, country: lastSegment(top.name) };
  } catch {
    return null;
  }
}

/** Reverse-geocode coords to a human label via Photon (same source as /api/geocode). */
async function reverseGeocode(lat: number, lon: number): Promise<{ name: string; country?: string } | null> {
  try {
    const u = new URL(PHOTON_REVERSE);
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lon", String(lon));
    const res = await fetch(u, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const top = normalizePhoton(await res.json(), 1)[0];
    if (!top) return null;
    return { name: top.name, country: lastSegment(top.name) };
  } catch {
    return null;
  }
}

function lastSegment(label: string): string | undefined {
  const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : undefined;
}

function json(body: GeolocateResponse, status: number): Response {
  return Response.json(body, { status });
}
