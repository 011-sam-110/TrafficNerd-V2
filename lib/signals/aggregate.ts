// Shared helpers for the country-AGGREGATED signal layers (cyber threat, displacement)
// — sources that are only country-coded (no precise lat/lon), so we group rows by
// country, place one marker at the country centroid, and size it by the count.

/**
 * Map a raw count to the ~0–10 `magnitude` radius driver the WorldMap circle layer
 * reads (see lib/signals/types.ts). Log-scaled so a country with 200 events isn't a
 * giant blob next to one with 5, clamped to [2,10] so every marker stays visible.
 */
export function countMagnitude(n: number): number {
  if (n <= 0) return 0;
  return Math.min(10, Math.max(2, Math.round(Math.log10(n + 1) * 40) / 10));
}

/** Group rows by a derived (upper-cased, non-empty) country key. */
export function groupByCountry<T>(rows: T[], keyOf: (r: T) => string | null | undefined): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = (keyOf(r) ?? "").toUpperCase().trim();
    if (!k) continue;
    let list = out.get(k);
    if (!list) {
      list = [];
      out.set(k, list);
    }
    list.push(r);
  }
  return out;
}

/** Coerce UNHCR-style values (sometimes ints, sometimes strings like "0") to a number. */
export function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
