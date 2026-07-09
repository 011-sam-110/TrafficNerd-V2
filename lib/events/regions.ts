// lib/events/regions.ts
// PURE geographic bucketing for the Disasters & Events feed. Assigns each event a
// coarse operational REGION (so an operator scans by area of responsibility) and
// groups a NormalizedEvent[] by region or by hazard type, in a stable display
// order with counts.
//
// Honesty note: `regionOf` is a deliberately COARSE lon/lat box classifier for
// grouping the feed — NOT an authoritative political geography. Boxes overlap, so
// the first match in a fixed priority order wins; the order is chosen to place
// well-known cities in the intuitive bucket (see tests/unit/events-regions.test.ts).

import type { NormalizedEvent, EventType } from "@/lib/events/model";

export type RegionId =
  | "na" | "latam" | "eu" | "mena" | "africa" | "asia" | "oceania" | "polar" | "other";

export interface RegionMeta {
  id: RegionId;
  label: string;
}

/** Stable display order for region groups. */
export const REGIONS: RegionMeta[] = [
  { id: "na", label: "North America" },
  { id: "latam", label: "Latin America" },
  { id: "eu", label: "Europe" },
  { id: "mena", label: "Middle East & N. Africa" },
  { id: "africa", label: "Africa" },
  { id: "asia", label: "Asia / APAC" },
  { id: "oceania", label: "Oceania" },
  { id: "polar", label: "Polar" },
  { id: "other", label: "Other / Oceanic" },
];

export const REGION_LABEL: Record<RegionId, string> = REGIONS.reduce(
  (acc, r) => { acc[r.id] = r.label; return acc; },
  {} as Record<RegionId, string>,
);

const inBox = (lat: number, lon: number, s: number, n: number, w: number, e: number) =>
  lat >= s && lat <= n && lon >= w && lon <= e;

/**
 * Coarse region for a point. First matching box wins — order matters because the
 * boxes overlap. Malformed coords fall through to "other" (never thrown away).
 */
export function regionOf(lat: number, lon: number): RegionId {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "other";
  if (lat < -60) return "polar";
  // Oceania: Australia / NZ / SW + SE Pacific.
  if (inBox(lat, lon, -50, 0, 110, 180) || inBox(lat, lon, -50, 0, -180, -130)) return "oceania";
  if (inBox(lat, lon, 12, 42, -17, 63)) return "mena";
  if (inBox(lat, lon, 36, 82, -25, 60)) return "eu";
  if (inBox(lat, lon, -40, 12, -20, 52)) return "africa";
  if (inBox(lat, lon, -10, 82, 60, 180)) return "asia";
  if (inBox(lat, lon, 12, 85, -170, -50)) return "na";
  if (inBox(lat, lon, -60, 15, -125, -30)) return "latam";
  return "other";
}

/** Stable display order + labels for hazard-type groups. */
export const TYPE_ORDER: EventType[] = [
  "quake", "cyclone", "flood", "storm", "fire", "volcano", "disaster", "conflict", "other",
];

export const TYPE_LABEL: Record<EventType, string> = {
  quake: "Earthquakes",
  cyclone: "Cyclones",
  flood: "Floods",
  storm: "Storms",
  fire: "Wildfires",
  volcano: "Volcanoes",
  disaster: "Disasters",
  conflict: "Conflict",
  other: "Other",
};

export interface EventGroup {
  /** Stable key: the RegionId or EventType. */
  key: string;
  label: string;
  events: NormalizedEvent[];
}

/** Group events by coarse region, in REGIONS order, dropping empty buckets. */
export function groupByRegion(events: NormalizedEvent[]): EventGroup[] {
  const by = new Map<RegionId, NormalizedEvent[]>();
  for (const e of events) {
    const r = regionOf(e.geo.lat, e.geo.lon);
    const g = by.get(r) ?? [];
    g.push(e);
    by.set(r, g);
  }
  return REGIONS
    .filter((r) => by.has(r.id))
    .map((r) => ({ key: r.id, label: r.label, events: by.get(r.id)! }));
}

/** Group events by hazard type, in TYPE_ORDER, dropping empty buckets. */
export function groupByType(events: NormalizedEvent[]): EventGroup[] {
  const by = new Map<EventType, NormalizedEvent[]>();
  for (const e of events) {
    const g = by.get(e.type) ?? [];
    g.push(e);
    by.set(e.type, g);
  }
  return TYPE_ORDER
    .filter((t) => by.has(t))
    .map((t) => ({ key: t, label: TYPE_LABEL[t], events: by.get(t)! }));
}
