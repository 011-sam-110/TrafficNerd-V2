// Live aircraft from adsb.lol — a free, keyless, community ADS-B aggregator.
// Chosen over OpenSky because OpenSky's anonymous tier is too rate-limited for
// continuous polling (429s). adsb.lol also broadcasts the ADS-B emitter
// `category` + type code, so planes are classified accurately (not guessed).
//
// COVERAGE: adsb.lol's endpoint is point+radius (max 250 nm), with no global
// query, AND it rate-limits (~1 req/s). The old sweep fired all ~50 cells 8-at-a-
// time every refresh, which tripped 429/502 on most cells; because it served any
// sweep where even a FEW cells survived, it silently degraded to a US-only snapshot
// (the grid is North-America-first, so the survivors were always the US cells).
//
// ROLLING-WINDOW SWEEP: instead of bursting the whole grid, each refresh fetches
// only a small STRIDED WINDOW of ~6 cells — gently (sequential, ~1 req/s) so a
// single window never trips the limiter — and merges it into a rolling PER-CELL
// snapshot store. The served snapshot is the union of every cell whose data is
// still within a freshness TTL, so full-globe coverage fills in over one rotation
// (~2–3 min) and each cell's planes stay on the map until its next turn. A cell
// that keeps failing simply ages out of the TTL (stale data is dropped, never shown
// forever). The window is strided (not a contiguous NA-first block), so even a
// single window — hence a cold start — spans every continent instead of being
// US-biased. (Mid-ocean is still inherently sparse — these are ground-receiver
// feeds, not satellite ADS-B.)
//
// STORE-AND-SERVE: the window refresh runs inside Next's Data Cache
// (`unstable_cache`), so upstream is hit at most once per WINDOW_S for the ENTIRE
// deployment (stale-while-revalidate: visitors are served the shared stored union,
// never triggering their own live pull). The rolling per-cell store lives in module
// state; see fetchAircraft for the deployment-topology tradeoff. The served union
// is capped (MAX_AIRCRAFT) so the cached entry stays under the Data Cache 2 MB limit
// and the client payload stays reasonable.

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

// Cap the served set so the cached entry stays under the Data Cache's 2 MB limit
// and the client payload stays reasonable. Airborne aircraft are kept before ground.
export const MAX_AIRCRAFT = 3000;

// --- Rolling-window sweep tuning ---------------------------------------------
// Cells fetched per refresh. Small enough that one window, fetched gently, never
// trips adsb.lol's ~1 req/s limiter (the old bug: 8 concurrent × 7 batches did).
export const WINDOW_SIZE = 6;
// Gap between the sequential per-cell requests inside a window. Sequential + this
// spacing keeps a window's handful of requests comfortably under the rate limit
// (averaged over WINDOW_S the window is well below 1 req/s).
const WINDOW_SPACING_MS = 700;
// How long a served union is cached before the next visitor triggers ONE window
// refresh. Over ~50 cells a full rotation is ceil(len / WINDOW_SIZE) windows; at
// WINDOW_S = 15 that is ~2–2.5 min to first full-globe coverage.
const WINDOW_S = 15;
// A cell's planes stay on the map this long after they were last fetched. Set
// comfortably LONGER than one full rotation so no cell ages out before its next
// turn, but finite so a cell that keeps failing is honestly dropped, not frozen.
const CELL_TTL_MS = 240_000;

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

// A rolling snapshot of the most-recent SUCCESSFUL result per grid cell, each
// stamped with when it landed. The served snapshot is the union of all cells still
// within CELL_TTL_MS (see collectFresh); overlapping cells are deduped by hex.
export interface CellSnapshot {
  /** Epoch ms when this cell's data was last fetched. */
  at: number;
  aircraft: Aircraft[];
}
export type CellStore = Map<number, CellSnapshot>;

/**
 * Grid indices to fetch on rotation `step`. STRIDED (not a contiguous block): each
 * window is spread across the whole grid, so a cold start or partial fill still
 * shows planes on every continent instead of clustering in the North-America-first
 * cells. Over `ceil(gridLen / windowSize)` steps every index is visited exactly
 * once, then it wraps. Pure — the rotation/window logic is fully unit-testable.
 */
export function windowIndices(gridLen: number, windowSize: number, step: number): number[] {
  if (gridLen <= 0 || windowSize <= 0) return [];
  const numWindows = Math.ceil(gridLen / windowSize);
  const start = ((step % numWindows) + numWindows) % numWindows; // safe for negative step
  const out: number[] = [];
  for (let i = start; i < gridLen; i += numWindows) out.push(i);
  return out;
}

/**
 * Merge a window's SUCCESSFUL cell results into the rolling store, stamped `at`.
 * Failed cells are not passed in, so their previous snapshot is left untouched and
 * keeps being served until CELL_TTL_MS prunes it. Mutates and returns `store`. Pure.
 */
export function applyWindow(
  store: CellStore,
  successes: { index: number; aircraft: Aircraft[] }[],
  at: number,
): CellStore {
  for (const { index, aircraft } of successes) store.set(index, { at, aircraft });
  return store;
}

/**
 * Prune cells older than `ttlMs`, then return the deduped union of the survivors.
 * Dedupe is by hex, preferring the FRESHEST cell so a plane seen by two overlapping
 * cells uses its most recent position. Mutates `store` (drops expired cells). Pure.
 */
export function collectFresh(store: CellStore, now: number, ttlMs: number): Aircraft[] {
  const live: CellSnapshot[] = [];
  for (const [index, snap] of store) {
    if (now - snap.at > ttlMs) store.delete(index);
    else live.push(snap);
  }
  live.sort((a, b) => a.at - b.at); // oldest first → the freshest cell wins each hex slot
  const byHex = new Map<string, Aircraft>();
  for (const snap of live) for (const a of snap.aircraft) byHex.set(a.hex, a);
  return [...byHex.values()];
}

// --- Rolling module state (see fetchAircraft for the serverless tradeoff) ------
const cellStore: CellStore = new Map();
// Seed the rotation phase from wall-clock so a freshly-booted instance doesn't
// always begin at window 0 — "rotate the start" so coverage is never US-biased,
// belt-and-suspenders on top of the already-strided windows.
let windowStep = Math.floor(Date.now() / (WINDOW_S * 1000));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch one window's cells sequentially and gently; silently skip any that fail. */
async function fetchWindow(indices: number[]): Promise<{ index: number; aircraft: Aircraft[] }[]> {
  const out: { index: number; aircraft: Aircraft[] }[] = [];
  for (let k = 0; k < indices.length; k++) {
    const index = indices[k];
    try {
      const rows = await fetchRegion(ADSB_GRID[index]);
      out.push({ index, aircraft: parseAdsb(rows) });
    } catch {
      // Per-cell failure is fine: this cell keeps its last-good snapshot until the
      // TTL prunes it; a whole-window failure just re-serves the still-fresh union.
    }
    if (k < indices.length - 1) await sleep(WINDOW_SPACING_MS);
  }
  return out;
}

/**
 * Fetch the NEXT strided window, merge it into the rolling store, and return the
 * capped union of all still-fresh cells. Never throws — a totally failed window
 * just serves the previously-accumulated (TTL-bounded) union, or [] on a cold start
 * with nothing yet, so the Data Cache never memoises a thrown error.
 */
async function refreshWindow(): Promise<WorldObject[]> {
  const indices = windowIndices(ADSB_GRID.length, WINDOW_SIZE, windowStep);
  windowStep++;
  const successes = await fetchWindow(indices);
  const now = Date.now();
  applyWindow(cellStore, successes, now);
  const fresh = collectFresh(cellStore, now, CELL_TTL_MS);
  const objects = fresh.map(aircraftToWorldObject);
  return capAircraft(objects, MAX_AIRCRAFT);
}

/**
 * Live aircraft worldwide as WorldObjects. Each refresh advances the rolling window
 * by one strided step and returns the union of all still-fresh cells. The refresh is
 * wrapped in Next's Data Cache, so upstream is polled at most once per WINDOW_S for
 * the whole deployment (stale-while-revalidate) and every visitor is served the
 * shared stored union rather than triggering their own live pull. Returns [] only on
 * a cold total failure (or outside the Next runtime, e.g. unit tests).
 *
 * TRADEOFF: the per-cell store (cellStore / windowStep) is MODULE state, so it
 * accumulates per warm serverless instance. In the common single-instance case the
 * served union is coherent and grows monotonically. With several warm instances each
 * keeps its own rolling store, and the cached value is whatever instance last
 * revalidated — so a revalidation that lands on a freshly-booted (still-filling)
 * instance can briefly serve a sparser union until the next rotation re-fills it
 * (self-heals within ~one rotation). We accept this over a heavier cross-instance
 * store: it stays keyless, dormant-safe, and gentle on adsb.lol, and it never
 * fabricates or freezes data — stale cells are always TTL-pruned.
 */
export async function fetchAircraft(): Promise<WorldObject[]> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(refreshWindow, ["aircraft-window-v2"], { revalidate: WINDOW_S })();
  } catch {
    return [];
  }
}
