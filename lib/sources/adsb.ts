// Live aircraft from adsb.lol — a free, keyless, community ADS-B aggregator.
// Chosen over OpenSky because OpenSky's anonymous tier is too rate-limited for
// continuous polling (429s). adsb.lol also broadcasts the ADS-B emitter
// `category` + type code, so planes are classified accurately (not guessed).
//
// COVERAGE: adsb.lol's endpoint is point+radius (max 250 nm), with no global
// query. We sweep a coarse worldwide grid of ~25 busy-airspace centres and merge
// the results, so cross-border / intercontinental flights show up. (Mid-ocean is
// inherently sparse — these are ground-receiver feeds, not satellite ADS-B.)
//
// STORE-AND-SERVE: the whole sweep runs inside Next's Data Cache
// (`unstable_cache`), a store shared across every serverless instance. Upstream is
// therefore hit at most once per REVALIDATE_S for the ENTIRE deployment, and every
// visitor is served the same stored snapshot rather than triggering their own
// live pull. The result is capped (MAX_AIRCRAFT) so the cached entry stays under
// the Data Cache 2 MB limit and the client payload stays reasonable.

import type { WorldObject } from "@/lib/world";
import { classifyPlane, ADSB_CATEGORY } from "@/lib/planes/classify";
import { PLANE_META } from "@/lib/icons/svg";

export interface AdsbRegion {
  lat: number;
  lon: number;
  distNm: number;
}

// A coarse worldwide grid of busy-airspace centres, each a 250 nm (adsb.lol max)
// point+radius query, merged into one snapshot. Overlaps are deduped by hex;
// "region" chips in the UI are derived from lat/lon, not these.
//
// Beyond the metro hubs we deliberately seed OCEANIC GATEWAY + COASTAL + under-
// served-land cells (North Atlantic tracks via Reykjavik/Gander/Azores/Shannon;
// the Pacific via Anchorage/Honolulu/Guam/Fiji; plus interior land gaps). Terrestrial
// ADS-B is line-of-sight to a ground receiver, so DEEP mid-ocean is inherently
// invisible here — these cells reach as far offshore as real coverage allows and
// pick up the coastal-water + cross-border legs the old 25-cell grid missed. The
// whole sweep is cached deployment-wide (see below), so more cells ≠ more per-visitor
// load. True mid-ocean would need satellite ADS-B (paid) — labelled honestly in the UI.
const NM = 250;
export const ADSB_GRID: AdsbRegion[] = [
  // North America
  { lat: 34.0, lon: -118.2, distNm: NM }, // Los Angeles
  { lat: 39.7, lon: -104.9, distNm: NM }, // Denver
  { lat: 41.9, lon: -87.9, distNm: NM }, // Chicago
  { lat: 40.7, lon: -74.0, distNm: NM }, // New York
  { lat: 25.8, lon: -80.3, distNm: NM }, // Miami
  { lat: 32.9, lon: -97.0, distNm: NM }, // Dallas–Fort Worth
  { lat: 47.4, lon: -122.3, distNm: NM }, // Seattle / Vancouver
  { lat: 43.7, lon: -79.4, distNm: NM }, // Toronto
  { lat: 19.4, lon: -99.1, distNm: NM }, // Mexico City
  { lat: 61.2, lon: -149.9, distNm: NM }, // Anchorage (Pacific/Arctic gateway)
  { lat: 21.3, lon: -157.9, distNm: NM }, // Honolulu (mid-Pacific)
  // North Atlantic oceanic corridor
  { lat: 64.1, lon: -21.9, distNm: NM }, // Reykjavík
  { lat: 48.9, lon: -54.6, distNm: NM }, // Gander (Newfoundland, NAT tracks)
  { lat: 37.7, lon: -25.7, distNm: NM }, // Azores
  { lat: 52.7, lon: -8.9, distNm: NM }, // Shannon (NAT entry)
  // South America
  { lat: 9.0, lon: -79.5, distNm: NM }, // Panama
  { lat: 4.7, lon: -74.1, distNm: NM }, // Bogotá
  { lat: -12.0, lon: -77.0, distNm: NM }, // Lima
  { lat: -23.5, lon: -46.6, distNm: NM }, // São Paulo
  { lat: -33.4, lon: -70.7, distNm: NM }, // Santiago
  { lat: -34.6, lon: -58.4, distNm: NM }, // Buenos Aires
  // Europe
  { lat: 51.5, lon: -0.1, distNm: NM }, // London
  { lat: 50.0, lon: 8.6, distNm: NM }, // Frankfurt
  { lat: 40.4, lon: -3.7, distNm: NM }, // Madrid
  { lat: 41.9, lon: 12.5, distNm: NM }, // Rome
  { lat: 41.0, lon: 28.9, distNm: NM }, // Istanbul
  { lat: 55.7, lon: 37.6, distNm: NM }, // Moscow
  // Middle East
  { lat: 25.2, lon: 55.3, distNm: NM }, // Dubai
  { lat: 24.7, lon: 46.7, distNm: NM }, // Riyadh
  { lat: 35.7, lon: 51.4, distNm: NM }, // Tehran
  // Africa
  { lat: 33.6, lon: -7.6, distNm: NM }, // Casablanca
  { lat: 30.0, lon: 31.2, distNm: NM }, // Cairo
  { lat: 6.5, lon: 3.4, distNm: NM }, // Lagos
  { lat: -1.3, lon: 36.8, distNm: NM }, // Nairobi
  { lat: -26.2, lon: 28.0, distNm: NM }, // Johannesburg
  // Asia
  { lat: 24.9, lon: 67.0, distNm: NM }, // Karachi
  { lat: 19.1, lon: 72.9, distNm: NM }, // Mumbai
  { lat: 28.6, lon: 77.2, distNm: NM }, // Delhi
  { lat: 13.7, lon: 100.5, distNm: NM }, // Bangkok
  { lat: 1.35, lon: 103.8, distNm: NM }, // Singapore
  { lat: -6.1, lon: 106.8, distNm: NM }, // Jakarta
  { lat: 22.3, lon: 114.2, distNm: NM }, // Hong Kong
  { lat: 31.2, lon: 121.5, distNm: NM }, // Shanghai
  { lat: 39.9, lon: 116.4, distNm: NM }, // Beijing
  { lat: 37.5, lon: 127.0, distNm: NM }, // Seoul
  { lat: 14.5, lon: 121.0, distNm: NM }, // Manila
  { lat: 35.6, lon: 139.8, distNm: NM }, // Tokyo
  // Oceania & Pacific
  { lat: 13.5, lon: 144.8, distNm: NM }, // Guam (west Pacific)
  { lat: -31.9, lon: 115.9, distNm: NM }, // Perth
  { lat: -33.9, lon: 151.2, distNm: NM }, // Sydney
  { lat: -37.0, lon: 174.8, distNm: NM }, // Auckland
  { lat: -17.8, lon: 177.4, distNm: NM }, // Nadi (Fiji, south Pacific)
];

export interface Aircraft {
  hex: string;
  callsign: string;
  lat: number;
  lon: number;
  altKm: number;
  headingDeg: number;
  velocityMs: number | null;
  verticalRateMs: number | null;
  onGround: boolean;
  category: string;
  typeCode: string;
  registration: string;
  squawk: string;
}

const KT_TO_MS = 0.514444;
const FT_TO_KM = 0.0003048;
const FPM_TO_MS = 0.00508;

interface RawAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  category?: string;
  squawk?: string;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Parse adsb.lol aircraft rows into typed {@link Aircraft} (skips no-position). */
export function parseAdsb(rows: RawAircraft[]): Aircraft[] {
  const out: Aircraft[] = [];
  for (const a of rows ?? []) {
    const lat = num(a.lat);
    const lon = num(a.lon);
    if (lat === null || lon === null) continue;
    const onGround = a.alt_baro === "ground";
    const altFt = onGround ? 0 : num(a.alt_baro) ?? 0;
    const gs = num(a.gs);
    const vr = num(a.baro_rate) ?? num(a.geom_rate);
    const hex = (a.hex ?? "").trim() || "unknown";
    const callsign = (a.flight ?? "").trim() || hex;
    out.push({
      hex,
      callsign,
      lat,
      lon,
      altKm: altFt * FT_TO_KM,
      headingDeg: num(a.track) ?? num(a.true_heading) ?? 0,
      velocityMs: gs === null ? null : gs * KT_TO_MS,
      verticalRateMs: vr === null ? null : vr * FPM_TO_MS,
      onGround,
      category: (a.category ?? "").trim(),
      typeCode: (a.t ?? "").trim(),
      registration: (a.r ?? "").trim(),
      squawk: (a.squawk ?? "").trim(),
    });
  }
  return out;
}

/** Map an {@link Aircraft} to a {@link WorldObject} with the right type icon. */
export function aircraftToWorldObject(a: Aircraft): WorldObject {
  const category = classifyPlane({
    altKm: a.altKm,
    velocityMs: a.velocityMs,
    onGround: a.onGround,
    category: a.category,
  });
  const meta = PLANE_META[category];
  return {
    kind: "plane",
    id: `plane:${a.hex}`,
    lat: a.lat,
    lon: a.lon,
    altKm: a.altKm,
    heading: a.headingDeg,
    label: a.callsign,
    color: meta.color,
    icon: meta.key,
    typeLabel: meta.label,
    meta: {
      callsign: a.callsign,
      registration: a.registration,
      typeCode: a.typeCode,
      adsbCategory: a.category,
      velocityMs: a.velocityMs,
      altKm: a.altKm,
      verticalRateMs: a.verticalRateMs,
      onGround: a.onGround,
      headingDeg: a.headingDeg,
      category,
      typeLabel: meta.label,
      // Whether the type came from a real ADS-B category vs the profile guess. Gated
      // on the SAME map classifyPlane trusts, so codes it doesn't map (A6, B0, C*, …)
      // are honestly reported as "estimate", not falsely as authoritative ADS-B.
      categorySource: a.category && ADSB_CATEGORY[a.category] ? "adsb" : "estimate",
      squawk: a.squawk,
    },
  };
}

// How long a stored global sweep is served before the next visitor triggers a
// refresh. Planes move, but ~25 s staleness is invisible on a world map and keeps
// upstream load predictable regardless of traffic.
const REVALIDATE_S = 25;
// Cap the served set so the cached entry stays under the Data Cache's 2 MB limit
// and the client payload stays reasonable. Airborne aircraft are kept before ground.
export const MAX_AIRCRAFT = 3000;
// Grid cells fetched at once. With ~50 cells a batch of 8 keeps the whole sweep
// well inside REVALIDATE_S while staying friendly to the community API (no herd —
// the sweep runs once per deployment per window, not once per visitor).
const CONCURRENCY = 8;

async function fetchRegion(r: AdsbRegion): Promise<RawAircraft[]> {
  const url = `https://api.adsb.lol/v2/lat/${r.lat}/lon/${r.lon}/dist/${r.distNm}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`adsb.lol ${r.lat},${r.lon}: ${res.status}`);
  const json = (await res.json()) as { ac?: RawAircraft[]; aircraft?: RawAircraft[] };
  return json.ac ?? json.aircraft ?? [];
}

/** Keep at most `cap` aircraft, preferring airborne over ground. Pure/testable. */
export function capAircraft(objects: WorldObject[], cap: number): WorldObject[] {
  if (objects.length <= cap) return objects;
  const airborne: WorldObject[] = [];
  const ground: WorldObject[] = [];
  for (const o of objects) {
    ((o.meta as { onGround?: boolean } | undefined)?.onGround ? ground : airborne).push(o);
  }
  return [...airborne, ...ground].slice(0, cap);
}

/**
 * Sweep the whole grid (batched by CONCURRENCY), dedupe by hex, and cap. Throws
 * only if EVERY cell fails — that way the Data Cache keeps serving the last good
 * snapshot instead of overwriting it with an empty one.
 */
async function pullAircraft(): Promise<WorldObject[]> {
  const rows: RawAircraft[] = [];
  let ok = 0;
  for (let i = 0; i < ADSB_GRID.length; i += CONCURRENCY) {
    const settled = await Promise.allSettled(ADSB_GRID.slice(i, i + CONCURRENCY).map(fetchRegion));
    for (const s of settled) {
      if (s.status === "fulfilled") {
        ok++;
        rows.push(...s.value);
      }
    }
  }
  if (ok === 0) throw new Error("all adsb.lol grid cells failed");

  const byHex = new Map<string, Aircraft>();
  for (const a of parseAdsb(rows)) byHex.set(a.hex, a); // dedupe overlapping cells
  const objects = [...byHex.values()].map(aircraftToWorldObject);
  return capAircraft(objects, MAX_AIRCRAFT);
}

/**
 * Live aircraft worldwide as WorldObjects. The sweep is wrapped in Next's Data
 * Cache, so upstream is polled at most once per REVALIDATE_S for the whole
 * deployment and every visitor is served the shared stored snapshot. Returns []
 * only on a cold total failure (or outside the Next runtime, e.g. unit tests).
 */
export async function fetchAircraft(): Promise<WorldObject[]> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(pullAircraft, ["aircraft-global-v1"], { revalidate: REVALIDATE_S })();
  } catch {
    return [];
  }
}
