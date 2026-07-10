// Pure helpers for the FORECAST/INDEX focus view (kind:"forecast") — geomagnetic
// storm index (space weather) and the aurora-visibility field. Deterministic and
// node-testable. No fabrication: an empty field yields an honest "all-clear".

import type { ForecastBand } from "@/lib/signals/types";
export type { ForecastBand };

/** Pick the band a value falls in (highest `min` ≤ value). null when below all bands. */
export function pickBand(value: number, bands: ForecastBand[] | undefined): ForecastBand | null {
  if (!bands || bands.length === 0 || !Number.isFinite(value)) return null;
  let hit: ForecastBand | null = null;
  for (const b of bands) if (value >= b.min && (!hit || b.min >= hit.min)) hit = b;
  return hit;
}

/**
 * Most-equatorward latitude with a value in each hemisphere — the "aurora reaches
 * down to X°N / up to Y°S" line. north = smallest positive lat; south = largest
 * negative lat (closest to the equator). null when a hemisphere has no cells.
 */
export function hemisphereExtent(lats: number[]): { north: number | null; south: number | null } {
  let north: number | null = null;
  let south: number | null = null;
  for (const l of lats) {
    if (!Number.isFinite(l)) continue;
    if (l > 0) north = north == null ? l : Math.min(north, l);
    else if (l < 0) south = south == null ? l : Math.max(south, l);
  }
  return { north, south };
}

/** Format a most-equatorward latitude as "52°N" / "47°S". "" when null. */
export function extentLabel(lat: number | null): string {
  if (lat == null || !Number.isFinite(lat)) return "";
  return `${Math.round(Math.abs(lat))}°${lat >= 0 ? "N" : "S"}`;
}
