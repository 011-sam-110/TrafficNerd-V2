// Pure, defensive parsing of the /api/geolocate JSON body — client-side twin of the
// route's own normalisation. The API route already returns a clean GeolocateResponse,
// but the console widget and the /locate page both fetch it over the wire, where a
// dormant backend, a proxy error page, or a truncated body could hand back anything.
// Coercing here (never `as GeolocateResponse`) keeps the UI dormant-safe: a malformed
// body resolves to zero candidates + a labelled note, never a throw or a bad pin.
//
// Nothing in this file performs I/O — it is unit-tested with zero network.

import { clampConfidence, isValidCoord } from "./normalize";
import type { GeolocateMethod, GeolocateResponse, ResolvedCandidate } from "./types";

const METHODS: GeolocateMethod[] = ["vision-ai", "geo-model"];

/** Trimmed non-empty string, or undefined. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Coerce one wire row into a plottable ResolvedCandidate, or null if it has no
 *  valid coordinates (an un-plottable row is dropped rather than faked to 0,0). */
export function toResolvedCandidate(row: unknown): ResolvedCandidate | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const lat = r.lat;
  const lon = r.lon;
  if (!isValidCoord(lat, lon)) return null;
  return {
    place: str(r.place) ?? "",
    country: str(r.country),
    lat: lat as number,
    lon: lon as number,
    confidence: clampConfidence(r.confidence),
    reasoning: str(r.reasoning),
  };
}

/**
 * Coerce an arbitrary fetched body into a safe GeolocateResponse. Total and pure —
 * never throws. Unknown/absent methods fall back to "vision-ai" (the default backend);
 * only candidates with in-range coordinates survive; error/note pass through when present.
 */
export function parseGeolocateResponse(body: unknown): GeolocateResponse {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const list = Array.isArray(b.candidates) ? b.candidates : [];
  const candidates = list
    .map(toResolvedCandidate)
    .filter((c): c is ResolvedCandidate => c !== null);
  const method: GeolocateMethod = METHODS.includes(b.method as GeolocateMethod)
    ? (b.method as GeolocateMethod)
    : "vision-ai";
  return {
    candidates,
    method,
    error: str(b.error),
    note: str(b.note),
  };
}
