// lib/events/filters.ts
// PURE signal-to-noise filtering for the Disasters & Events feed. The operator's
// tuning (min severity, min quake magnitude, hazard-type allow-set, region
// allow-set) is persisted in the widget `config` bag; this module both coerces it
// out of that bag and applies it, returning the kept rows AND an honest hidden
// count so the UI can surface "N hidden by filters" (never silently drop data).

import { type NormalizedEvent, type SeverityTier, type EventType, severityRank } from "@/lib/events/model";
import { regionOf, type RegionId, REGIONS, TYPE_ORDER } from "@/lib/events/regions";

export interface EventFilters {
  /** Hide events below this display tier. */
  minTier: SeverityTier;
  /** Hide quakes whose native magnitude is below this (0 = off). Non-quakes ignore it. */
  minQuakeMag: number;
  /** null = all hazard types kept; otherwise only these are kept. */
  types: EventType[] | null;
  /** null = all regions kept; otherwise only these are kept. */
  regions: RegionId[] | null;
}

export const DEFAULT_FILTERS: EventFilters = {
  minTier: "S1",
  minQuakeMag: 0,
  types: null,
  regions: null,
};

const TIER_SET = new Set<SeverityTier>(["S0", "S1", "S2", "S3", "S4"]);
const TYPE_SET = new Set<EventType>(TYPE_ORDER);
const REGION_SET = new Set<RegionId>(REGIONS.map((r) => r.id));

/** Coerce a persisted config bag into a valid EventFilters (garbage → defaults). */
export function readFilters(config: Record<string, unknown>): EventFilters {
  const tierRaw = (config.evMinTier ?? config.minTier) as SeverityTier;
  const minTier = TIER_SET.has(tierRaw) ? tierRaw : DEFAULT_FILTERS.minTier;

  const magRaw = Number(config.evMinQuakeMag);
  const minQuakeMag = Number.isFinite(magRaw) && magRaw > 0 ? magRaw : 0;

  const types = coerceSet(config.evTypes, TYPE_SET);
  const regions = coerceSet(config.evRegions, REGION_SET);

  return { minTier, minQuakeMag, types, regions };
}

function coerceSet<T>(raw: unknown, valid: Set<T>): T[] | null {
  if (!Array.isArray(raw)) return null; // absent / junk = "all"
  const kept = raw.filter((v): v is T => valid.has(v as T));
  // An empty allow-set is a real state ("hide everything of this axis") — keep it.
  return kept;
}

/** Does a single event pass the filters? PURE, exported for direct testing. */
export function passesFilters(e: NormalizedEvent, f: EventFilters): boolean {
  if (severityRank(e.severity.tier) < severityRank(f.minTier)) return false;
  if (e.type === "quake" && f.minQuakeMag > 0) {
    const mag = e.magnitude?.value;
    if (mag != null && mag < f.minQuakeMag) return false;
  }
  if (f.types && !f.types.includes(e.type)) return false;
  if (f.regions && !f.regions.includes(regionOf(e.geo.lat, e.geo.lon))) return false;
  return true;
}

export interface FilteredFeed {
  rows: NormalizedEvent[];
  /** Count removed by the filters (relative to the input) — for the honest affordance. */
  hidden: number;
}

/** Apply the filters, preserving input order; report how many were hidden. */
export function applyEventFilters(rows: NormalizedEvent[], f: EventFilters): FilteredFeed {
  const kept = rows.filter((e) => passesFilters(e, f));
  return { rows: kept, hidden: rows.length - kept.length };
}

/**
 * PURE chip toggle for an allow-set axis (hazard types / regions). `null` means
 * "all"; clicking an item toggles its membership. Selecting the whole universe
 * collapses back to `null` (the compact "all allowed" state).
 */
export function toggleAllowSet<T>(current: T[] | null, item: T, universe: T[]): T[] | null {
  const base = current ?? universe;
  const next = base.includes(item) ? base.filter((x) => x !== item) : [...base, item];
  const uni = new Set(universe);
  const nextSet = new Set(next);
  if (nextSet.size === uni.size && [...uni].every((x) => nextSet.has(x))) return null;
  return next;
}

/** Is `item` currently allowed by an allow-set (null = all allowed)? */
export function isAllowed<T>(current: T[] | null, item: T): boolean {
  return current === null || current.includes(item);
}

/** Is the filter set doing anything at all? (For the compact "showing all" case.) */
export function filtersActive(f: EventFilters): boolean {
  return (
    f.minTier !== "S0" ||
    f.minQuakeMag > 0 ||
    f.types !== null ||
    f.regions !== null
  );
}
