// Pure aviation helpers for the airspace-console focus view. All read the plane
// WorldObject (its meta carries the classified category/onGround/velocity), so no
// re-classification or fetch is needed. Unit-tested; the .tsx is a dumb shell.
import type { WorldObject } from "@/lib/world";
import type { PlaneCategory } from "@/lib/planes/classify";

const CATEGORY_LABEL: Record<PlaneCategory, string> = {
  airliner: "Airliner", regional: "Regional", light: "Light", helicopter: "Helicopter", ground: "Ground",
};
const CATEGORY_ORDER: PlaneCategory[] = ["airliner", "regional", "light", "helicopter", "ground"];

function meta(o: WorldObject): Record<string, unknown> { return (o.meta ?? {}) as Record<string, unknown>; }
function categoryOf(o: WorldObject): PlaneCategory {
  const c = meta(o).category;
  return (typeof c === "string" && c in CATEGORY_LABEL ? c : "light") as PlaneCategory;
}
function velocityOf(o: WorldObject): number | null {
  const v = meta(o).velocityMs;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface OpsSummary {
  total: number; airborne: number; ground: number;
  byCategory: { category: PlaneCategory; label: string; count: number }[];
  maxAltKm: number; maxSpeedMs: number;
}

export function opsSummary(objects: WorldObject[]): OpsSummary {
  let airborne = 0, ground = 0, maxAltKm = 0, maxSpeedMs = 0;
  const counts: Partial<Record<PlaneCategory, number>> = {};
  for (const o of objects) {
    if (meta(o).onGround) ground++; else airborne++;
    const c = categoryOf(o);
    counts[c] = (counts[c] ?? 0) + 1;
    if (typeof o.altKm === "number" && o.altKm > maxAltKm) maxAltKm = o.altKm;
    const v = velocityOf(o);
    if (v != null && v > maxSpeedMs) maxSpeedMs = v;
  }
  const byCategory = CATEGORY_ORDER.filter((c) => counts[c]).map((c) => ({ category: c, label: CATEGORY_LABEL[c], count: counts[c]! }));
  return { total: objects.length, airborne, ground, byCategory, maxAltKm, maxSpeedMs };
}

export type AltBand = "ground" | "0–1 km" | "1–3 km" | "3–7 km" | "7–11 km" | "11+ km";
export const ALT_BANDS: AltBand[] = ["11+ km", "7–11 km", "3–7 km", "1–3 km", "0–1 km", "ground"];
export function altitudeBand(o: WorldObject): AltBand {
  if (meta(o).onGround) return "ground";
  const a = typeof o.altKm === "number" ? o.altKm : 0;
  if (a < 1) return "0–1 km";
  if (a < 3) return "1–3 km";
  if (a < 7) return "3–7 km";
  if (a < 11) return "7–11 km";
  return "11+ km";
}

// Coarse continent buckets for the region filter/column. Derived purely from
// lat/lon — the aircraft grid is now worldwide, so "region" means the continent a
// flight is over, independent of which harvest cells fetched it.
export const REGION_LABELS = [
  "North America", "South America", "Europe", "Middle East", "Africa", "Asia", "Oceania",
];
// Ordered bounding boxes; the first box that contains the point wins, so overlaps
// (Europe/Middle East/Africa around the Mediterranean) resolve by this priority.
const CONTINENT_BOXES: { label: string; latMin: number; latMax: number; lonMin: number; lonMax: number }[] = [
  { label: "North America", latMin: 7, latMax: 84, lonMin: -170, lonMax: -50 },
  { label: "South America", latMin: -56, latMax: 13, lonMin: -82, lonMax: -34 },
  { label: "Europe", latMin: 36, latMax: 72, lonMin: -25, lonMax: 40 },
  { label: "Middle East", latMin: 12, latMax: 42, lonMin: 34, lonMax: 63 },
  { label: "Africa", latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
  { label: "Asia", latMin: 5, latMax: 78, lonMin: 40, lonMax: 180 },
  { label: "Oceania", latMin: -50, latMax: 0, lonMin: 110, lonMax: 180 },
];
/** Coarse continent for a coordinate (first matching box), or "—" if unclassified. */
export function regionOf(lat: number, lon: number): string {
  for (const b of CONTINENT_BOXES) {
    if (lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) return b.label;
  }
  return "—";
}

export type FlightSortKey = "altitude" | "speed" | "callsign" | "region";
export function sortFlights(objects: WorldObject[], key: FlightSortKey, dir: 1 | -1): WorldObject[] {
  const cmp = (a: WorldObject, b: WorldObject): number => {
    if (key === "callsign") return a.label.localeCompare(b.label);
    if (key === "region") return regionOf(a.lat, a.lon).localeCompare(regionOf(b.lat, b.lon));
    if (key === "speed") return (velocityOf(a) ?? -Infinity) - (velocityOf(b) ?? -Infinity);
    return (a.altKm ?? -Infinity) - (b.altKm ?? -Infinity);
  };
  return [...objects].sort((a, b) => dir * cmp(a, b));
}
