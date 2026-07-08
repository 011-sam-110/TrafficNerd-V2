// Live aircraft from adsb.lol — a free, keyless, community ADS-B aggregator.
// Chosen over OpenSky because OpenSky's anonymous tier is too rate-limited for
// continuous polling (429s). adsb.lol also broadcasts the ADS-B emitter
// `category` + type code, so planes are classified accurately (not guessed).
//
// We query a few point+radius regions (matching the camera regions) and merge
// them, so planes appear wherever a viewer flies.

import type { WorldObject } from "@/lib/world";
import { classifyPlane, ADSB_CATEGORY } from "@/lib/planes/classify";
import { PLANE_META } from "@/lib/icons/svg";

export interface AdsbRegion {
  lat: number;
  lon: number;
  distNm: number;
}

// Centred on the camera regions. Radii kept moderate so dense airspace stays
// legible (individual planes + trails readable) rather than blobbing together.
export const ADSB_REGIONS: AdsbRegion[] = [
  { lat: 51.5, lon: -0.12, distNm: 90 }, // London / SE England
  { lat: 36.8, lon: -119.7, distNm: 160 }, // California
  { lat: 33.9, lon: -80.9, distNm: 140 }, // South Carolina
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

// Short server-side cache so rapid client polls don't hammer adsb.lol.
const CACHE_TTL_MS = 8_000;
let cache: { objects: WorldObject[]; at: number } | null = null;

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

/**
 * Live aircraft across all regions as WorldObjects, deduped by hex, with an
 * 8 s cache. Returns the stale cache (or empty) if every region fails.
 */
export async function fetchAircraft(nowMs: number): Promise<WorldObject[]> {
  if (cache && nowMs - cache.at < CACHE_TTL_MS) return cache.objects;

  const results = await Promise.allSettled(ADSB_REGIONS.map(fetchRegion));
  const rows = results
    .filter((r): r is PromiseFulfilledResult<RawAircraft[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  if (rows.length === 0 && results.every((r) => r.status === "rejected")) {
    return cache?.objects ?? [];
  }

  const byHex = new Map<string, Aircraft>();
  for (const a of parseAdsb(rows)) byHex.set(a.hex, a); // dedupe overlapping regions
  const objects = [...byHex.values()].map(aircraftToWorldObject);
  cache = { objects, at: nowMs };
  return objects;
}
