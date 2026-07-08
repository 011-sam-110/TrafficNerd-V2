"use client";
// A small PERSISTED numeric time-series, keyed by an arbitrary series id
// (e.g. "mkt:BTC", "sig:instability"). Survives reloads via the SSR-safe
// localStorage helper, so sparklines accumulate across sessions instead of the
// old session-only in-memory buffer. Pure ring-buffer maths are reused from
// lib/widgets/history.ts (node-tested); this module only adds persistence.

import { pushSample, trendOf, type CountSample } from "@/lib/widgets/history";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

const KEY = "tn.series.v1";
const VERSION = 1;
const CAP = 48; // samples kept per series
const MAX_KEYS = 240; // guard total localStorage footprint

export type SeriesMap = Record<string, CountSample[]>;

let mem: SeriesMap | null = null;

function load(): SeriesMap {
  if (!mem) mem = loadPersisted<SeriesMap>(KEY, VERSION) ?? {};
  return mem;
}

/** Record a numeric sample for a series key (persisted, capped, isomorphic-safe). */
export function recordSeries(key: string, value: number, t: number): void {
  if (!key || !Number.isFinite(value)) return;
  const map = load();
  map[key] = pushSample(map[key] ?? [], { t, n: value }, CAP);
  const keys = Object.keys(map);
  if (keys.length > MAX_KEYS) delete map[keys[0]]; // evict oldest-inserted key
  savePersisted(KEY, VERSION, map);
}

/** Read the normalized 0..1 trend (last `slots`) for a series key. */
export function seriesTrend(key: string, slots: number): number[] {
  return trendOf(load()[key] ?? [], slots);
}

/** Read raw samples (for tooltips / playback). */
export function seriesSamples(key: string): CountSample[] {
  return (load()[key] ?? []).slice();
}

/** Test-only: reset the in-memory cache (persistence is injectable via persist). */
export function __resetSeries(): void {
  mem = null;
}
