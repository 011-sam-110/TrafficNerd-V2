// lib/map/inset.ts
// Pure GeoJSON + bounds helpers for the shared <InsetMap>. Node-testable.

export interface InsetPoint {
  lat: number;
  lon: number;
  id?: string;
  color?: string;
  props?: Record<string, unknown>;
}

export function pointsToFC(points: InsetPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { id: p.id ?? "", color: p.color ?? "#38bdf8", ...(p.props ?? {}) },
      })),
  };
}

export function boundsOf(points: InsetPoint[]): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if (p.lon < w) w = p.lon; if (p.lon > e) e = p.lon;
    if (p.lat < s) s = p.lat; if (p.lat > n) n = p.lat;
  }
  if (!Number.isFinite(w)) return null;
  return [[w, s], [e, n]];
}
