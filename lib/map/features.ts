// Pure GeoJSON FeatureCollection builders for the unified MapLibre engine.
//
// WorldMap renders every live layer (cameras, planes, trails, satellites) as a
// MapLibre GeoJSON source. These builders turn the shared WorldObject[] (and the
// plane trails) into the feature collections those sources consume. Kept DOM-free
// and pure so they're trivially testable and importable anywhere.

import type { WorldObject } from "@/lib/world";
import type { PlaneTrail } from "@/lib/planes/usePlanes";
import { cameraRegionColor } from "@/lib/icons/svg";

const KNOWN_REGIONS = ["tfl", "caltrans", "scdot", "digitraffic"];

/** Camera source id → icon region key ("default" for anything unmapped). */
export function regionKeyOf(source: string | undefined): string {
  return source && KNOWN_REGIONS.includes(source) ? source : "default";
}

/** Cameras → point features (shape = feed, colour = region, dimmed when down). */
export function toCameraFC(cameras: WorldObject[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cameras.map((c) => {
      const m = (c.meta ?? {}) as { available?: boolean; source?: string; feed?: string };
      const source = m.source;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
        properties: {
          id: c.id,
          name: c.label,
          available: Boolean(m.available),
          // icon name pieces: shape = feed, colour = region (see loadCameraIcons)
          feed: m.feed === "video" ? "video" : "still",
          regionKey: regionKeyOf(source),
          regionColor: c.color ?? cameraRegionColor(source ?? ""),
        },
      };
    }),
  };
}

/** Planes → point features carrying heading (icon-rotate) + per-type category. */
export function toPlaneFC(planes: WorldObject[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: planes.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        category: (p.meta?.category as string) ?? "airliner",
        heading: p.heading ?? 0,
        color: p.color ?? "#fbbf24",
      },
    })),
  };
}

/** Plane breadcrumb trails → line features (history + projected heading ahead). */
export function toTrailFC(trails: PlaneTrail[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trails
      .filter((t) => t.points.length >= 2)
      .map((t) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: t.points.map((p) => [p[1], p[0]]) },
        properties: { id: t.id, color: t.color },
      })),
  };
}

/** Satellites → sub-satellite point features (altitude lives in the dossier). */
export function toSatelliteFC(sats: WorldObject[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sats.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        id: s.id,
        name: s.label,
        color: s.color ?? "#cbd5e1",
      },
    })),
  };
}
