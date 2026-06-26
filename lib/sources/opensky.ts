/**
 * OpenSky Network — live aircraft state vectors.
 * Anonymous access: heavily rate-limited (few req/min). Cache 12 s server-side.
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
 */

import type { WorldObject } from "@/lib/world";
import { classifyPlane } from "@/lib/planes/classify";
import { PLANE_META } from "@/lib/icons/svg";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OpenSkyBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface Plane {
  icao24: string;
  callsign: string;           // trimmed; falls back to icao24 when blank
  lat: number;
  lon: number;
  altKm: number;              // (geo_altitude ?? baro_altitude ?? 0) / 1000
  headingDeg: number;         // true_track; 0 when null
  velocityMs: number | null;  // m/s ground speed; null when unknown
  verticalRateMs: number | null; // m/s climb (+) / descent (−); null when unknown
  onGround: boolean;
  country: string;            // origin_country string (not ISO code)
}

// ---------------------------------------------------------------------------
// Default bbox: UK + Ireland
// ---------------------------------------------------------------------------

export const DEFAULT_BBOX: OpenSkyBbox = {
  south: 49.5,
  west: -11,
  north: 61,
  east: 2,
};

const CACHE_TTL_MS = 12_000;

// ---------------------------------------------------------------------------
// State-vector index helpers (avoids magic numbers throughout the parser)
// ---------------------------------------------------------------------------

const IDX = {
  icao24: 0,
  callsign: 1,
  country: 2,
  // time_position: 3,
  // last_contact: 4,
  lon: 5,
  lat: 6,
  baro_altitude: 7,
  on_ground: 8,
  velocity: 9,
  true_track: 10,
  vertical_rate: 11,
  // sensors: 12,
  geo_altitude: 13,
  // squawk: 14,
  // spi: 15,
  // position_source: 16,
} as const;

// ---------------------------------------------------------------------------
// Type-safe accessors for the heterogeneous state-vector arrays
// ---------------------------------------------------------------------------

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asNum(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function asBool(v: unknown): boolean {
  return v === true;
}

// ---------------------------------------------------------------------------
// Core parser — exported for unit testing (pure, no I/O)
// ---------------------------------------------------------------------------

/**
 * Convert raw OpenSky state-vector arrays into typed {@link Plane} objects.
 * Rows where latitude OR longitude is null are silently skipped.
 */
export function parseStates(states: unknown[][]): Plane[] {
  const planes: Plane[] = [];

  for (const s of states) {
    const lat = asNum(s[IDX.lat]);
    const lon = asNum(s[IDX.lon]);
    if (lat === null || lon === null) continue;

    const geoAlt = asNum(s[IDX.geo_altitude]);
    const baroAlt = asNum(s[IDX.baro_altitude]);
    const altMeters = geoAlt ?? baroAlt ?? 0;

    const icao24 = asStr(s[IDX.icao24]) || "unknown";
    const rawCallsign = asStr(s[IDX.callsign]).trim();
    const callsign = rawCallsign || icao24;

    planes.push({
      icao24,
      callsign,
      lat,
      lon,
      altKm: altMeters / 1000,
      headingDeg: asNum(s[IDX.true_track]) ?? 0,
      velocityMs: asNum(s[IDX.velocity]),
      verticalRateMs: asNum(s[IDX.vertical_rate]),
      onGround: asBool(s[IDX.on_ground]),
      country: asStr(s[IDX.country]),
    });
  }

  return planes;
}

// ---------------------------------------------------------------------------
// WorldObject mapper — exported for unit testing + consumed by usePlanes hook
// ---------------------------------------------------------------------------

/**
 * Map a parsed {@link Plane} to the shared {@link WorldObject} contract so the
 * globe layer can render it uniformly alongside cameras and satellites.
 */
export function planeToWorldObject(p: Plane): WorldObject {
  const category = classifyPlane({
    altKm: p.altKm,
    velocityMs: p.velocityMs,
    onGround: p.onGround,
  });
  const meta = PLANE_META[category];
  return {
    kind: "plane",
    id: `plane:${p.icao24}`,
    lat: p.lat,
    lon: p.lon,
    altKm: p.altKm,
    heading: p.headingDeg,
    label: p.callsign,
    color: meta.color,
    icon: meta.key,
    typeLabel: meta.label,
    meta: {
      callsign: p.callsign,
      country: p.country,
      velocityMs: p.velocityMs,
      altKm: p.altKm,
      verticalRateMs: p.verticalRateMs,
      onGround: p.onGround,
      category,
      typeLabel: meta.label,
    },
  };
}

// ---------------------------------------------------------------------------
// In-module TTL cache keyed by bbox string
// ---------------------------------------------------------------------------

interface CacheEntry {
  planes: Plane[];
  fetchedAt: number;
}

const _cache = new Map<string, CacheEntry>();

function bboxKey(b: OpenSkyBbox): string {
  return `${b.south},${b.west},${b.north},${b.east}`;
}

// ---------------------------------------------------------------------------
// Main fetch — handles rate-limits, timeouts, null states, stale cache
// ---------------------------------------------------------------------------

interface OpenSkyResponse {
  time: number;
  states: unknown[][] | null;
}

/**
 * Fetch live state vectors from OpenSky, with a 12-second server-side cache.
 * Gracefully handles: 429 (rate-limit), timeouts, null states, network errors.
 * Falls back to the last good cache entry (or empty array) on any failure.
 */
export async function fetchStates(bbox: OpenSkyBbox = DEFAULT_BBOX): Promise<Plane[]> {
  const key = bboxKey(bbox);
  const now = Date.now();
  const cached = _cache.get(key);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.planes;
  }

  const url =
    `https://opensky-network.org/api/states/all` +
    `?lamin=${bbox.south}&lomin=${bbox.west}&lamax=${bbox.north}&lomax=${bbox.east}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 429) {
      // Rate-limited — serve stale or empty
      return cached?.planes ?? [];
    }
    if (!res.ok) {
      // Any non-2xx error — serve stale or empty
      return cached?.planes ?? [];
    }

    const data = (await res.json()) as OpenSkyResponse;

    if (!data.states) {
      // OpenSky returns null states when bbox has no traffic or service is degraded
      return cached?.planes ?? [];
    }

    const planes = parseStates(data.states);
    _cache.set(key, { planes, fetchedAt: now });
    return planes;
  } catch {
    // Covers AbortError (timeout), network failure, JSON parse errors
    clearTimeout(timeoutId);
    return cached?.planes ?? [];
  }
}
