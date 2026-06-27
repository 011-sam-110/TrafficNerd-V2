// Pure, defensive normalization for photo-geolocation backends.
//
// Vision LLMs are asked for strict JSON but reliably misbehave: they wrap the
// object in ```json fences, prepend prose ("Here is my analysis:"), use 0–100
// confidence instead of 0–1, or return a bare array instead of {candidates:[…]}.
// The GeoCLIP sidecar returns clean rows but with no place names. Every wrinkle is
// handled HERE, in pure functions, so the route stays thin and this stays unit-
// testable with zero network. Nothing in this file performs I/O.

import type { RawCandidate } from "./types";

/** Clamp/normalise a confidence to 0..1. Accepts 0–1 floats and 0–100 percents,
 *  tolerates strings ("87%", "0.42") and garbage (→ 0). */
export function clampConfidence(v: unknown): number {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") n = parseFloat(v.replace(/[%\s]/g, ""));
  else n = NaN;
  if (!Number.isFinite(n)) return 0;
  if (n > 1) n = n / 100; // treat >1 as a percentage (87 → 0.87, 100 → 1)
  if (n < 0) return 0;
  if (n > 1) return 1; // a percentage like 250 still clamps
  return n;
}

/** True only for a real, in-range lat/lon pair. */
export function isValidCoord(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Coerce any value to a finite number or null (handles "48.8566" strings). */
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Pull the first JSON value out of a noisy LLM string. Strips ``` fences, then
 *  scans for the first balanced {...} or [...]. Returns parsed value or null. */
export function extractJson(raw: string): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return null;

  // Drop code fences (```json … ``` or ``` … ```).
  let s = raw.replace(/```(?:json)?/gi, "```");
  // Fast path: the whole thing already parses.
  const whole = tryParse(s.trim());
  if (whole !== undefined) return whole;

  // Otherwise find the first '{' or '[' and parse a balanced slice from it.
  s = s.replace(/```/g, " ");
  const start = firstOpenIndex(s);
  if (start === -1) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        const parsed = tryParse(s.slice(start, i + 1));
        if (parsed !== undefined) return parsed;
        return null;
      }
    }
  }
  return null;
}

function firstOpenIndex(s: string): number {
  const obj = s.indexOf("{");
  const arr = s.indexOf("[");
  if (obj === -1) return arr;
  if (arr === -1) return obj;
  return Math.min(obj, arr);
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** Accept {candidates:[…]} | {locations:[…]} | {results:[…]} | a bare [...]. */
function pluckArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    for (const k of ["candidates", "locations", "results", "predictions"]) {
      if (Array.isArray(o[k])) return o[k] as unknown[];
    }
    // A single object that looks like one candidate.
    if ("lat" in o || "place" in o || "country" in o) return [o];
  }
  return [];
}

export interface NormalizeOptions {
  /** Max candidates to keep after sorting by confidence (default 5). */
  limit?: number;
  /** Drop candidates that have neither valid coords nor a place name (default true). */
  requirePlaceOrCoord?: boolean;
}

/** Map an arbitrary parsed value to ranked RawCandidates: clamp confidence,
 *  validate coords (else null → caller geocodes the place), drop empties, sort
 *  by confidence desc, cap to limit. Pure and total — never throws. */
export function normalizeCandidates(parsed: unknown, opts: NormalizeOptions = {}): RawCandidate[] {
  const limit = opts.limit ?? 5;
  const requirePlaceOrCoord = opts.requirePlaceOrCoord ?? true;

  const rows = pluckArray(parsed);
  const out: RawCandidate[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    const place = String(r.place ?? r.name ?? r.city ?? r.location ?? "").trim();
    const country =
      typeof r.country === "string" && r.country.trim() ? r.country.trim() : undefined;

    const lat = num(r.lat ?? r.latitude);
    const lon = num(r.lon ?? r.lng ?? r.long ?? r.longitude);
    const coordOk = lat !== null && lon !== null && isValidCoord(lat, lon);

    if (requirePlaceOrCoord && !place && !coordOk) continue;

    const reasoning =
      typeof r.reasoning === "string" && r.reasoning.trim()
        ? r.reasoning.trim()
        : typeof r.reason === "string" && r.reason.trim()
          ? r.reason.trim()
          : undefined;

    out.push({
      place,
      country,
      lat: coordOk ? lat : null,
      lon: coordOk ? lon : null,
      confidence: clampConfidence(r.confidence ?? r.score ?? r.probability),
      reasoning,
    });
  }

  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, limit);
}

/** End-to-end vision-LLM parse: extract JSON from the raw completion text, then
 *  normalise. Returns [] for any unparseable / empty response. */
export function parseLlmResponse(raw: string, opts: NormalizeOptions = {}): RawCandidate[] {
  return normalizeCandidates(extractJson(raw), opts);
}

/** Normalise GeoCLIP sidecar rows: [{lat,lon,confidence|score}] (no place names —
 *  the route reverse-geocodes). Drops rows without valid coords. */
export function normalizeGeoclip(rows: unknown, opts: NormalizeOptions = {}): RawCandidate[] {
  const limit = opts.limit ?? 5;
  const arr = pluckArray(rows);
  const out: RawCandidate[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const lat = num(r.lat ?? r.latitude);
    const lon = num(r.lon ?? r.lng ?? r.longitude);
    if (lat === null || lon === null || !isValidCoord(lat, lon)) continue;
    out.push({
      place: "",
      lat,
      lon,
      confidence: clampConfidence(r.confidence ?? r.score ?? r.probability),
    });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, limit);
}
