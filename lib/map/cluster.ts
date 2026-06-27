// Smart marker clustering for the unified MapLibre engine.
//
// ~13k camera markers render as dot-soup when zoomed out. MapLibre's GeoJSON
// sources cluster natively, so the camera + webcam sources opt in here and
// WorldMap renders cluster circle + count layers on top of them. This module
// holds the (pure, testable) tuning + the cluster-expand interaction; the actual
// `step`/`circle` paint lives inline in WorldMap (it must be a literal to satisfy
// MapLibre's expression types), and mirrors CLUSTER_RADIUS_TIERS below.
//
// Per-type policy (per the smart-marker-clustering PRD): cameras + webcams
// cluster; planes + their trails stay individual (so headings/breadcrumbs read);
// satellites are never clustered. Only the camera + webcam sources set `cluster`.

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

/**
 * Cluster tuning shared by the camera + webcam sources.
 * - `clusterRadius` (px): merge markers within this screen distance.
 * - `clusterMaxZoom`: above this zoom every point is individual (clusters split
 *   fully apart), so the detailed icons (minzoom 5) take over on descent.
 */
export const CAMERA_CLUSTER = { clusterRadius: 50, clusterMaxZoom: 11 } as const;
export const WEBCAM_CLUSTER = { clusterRadius: 50, clusterMaxZoom: 11 } as const;

/**
 * point_count → soft circle radius (px). This is the source of truth the inline
 * `step` expression in WorldMap mirrors; the unit test guards them from drifting.
 * Tiers grow gently so density reads at a glance without shouting (calm-light).
 */
export const CLUSTER_RADIUS_TIERS: ReadonlyArray<readonly [min: number, radius: number]> = [
  [0, 15],
  [25, 19],
  [100, 24],
  [750, 30],
];

/** Largest tier whose `min` ≤ count → the cluster circle radius (px). Pure. */
export function clusterRadiusForCount(count: number): number {
  let radius = CLUSTER_RADIUS_TIERS[0][1];
  for (const [min, r] of CLUSTER_RADIUS_TIERS) if (count >= min) radius = r;
  return radius;
}

/**
 * Where to ease the camera when splitting a cluster: never zoom out, and always
 * make at least a little progress even if the cluster's expansion zoom is the
 * current zoom (e.g. a max-zoom cluster). Pure → unit-tested.
 */
export function nextClusterZoom(expansionZoom: number, currentZoom: number): number {
  return Math.max(expansionZoom, currentZoom + 0.5);
}

/**
 * Click-a-cluster behaviour: query MapLibre for the zoom at which this cluster
 * splits, then ease the camera into it. Thin DOM/map shell over the pure
 * {@link nextClusterZoom}; degrades to a fixed zoom-in if the query fails.
 */
export async function expandCluster(
  map: MapLibreMap,
  sourceId: string,
  clusterId: number,
  center: [number, number],
): Promise<void> {
  const src = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!src || typeof src.getClusterExpansionZoom !== "function") return;
  try {
    const zoom = await src.getClusterExpansionZoom(clusterId);
    map.easeTo({ center, zoom: nextClusterZoom(zoom, map.getZoom()), duration: 600 });
  } catch {
    map.easeTo({ center, zoom: map.getZoom() + 2, duration: 600 });
  }
}
