import { expect, test } from "vitest";
import {
  CAMERA_CLUSTER,
  WEBCAM_CLUSTER,
  CLUSTER_RADIUS_TIERS,
  clusterRadiusForCount,
  nextClusterZoom,
} from "@/lib/map/cluster";
import { toPlaneFC } from "@/lib/map/features";

test("cluster config is sane (positive radius, splits before max map zoom)", () => {
  for (const cfg of [CAMERA_CLUSTER, WEBCAM_CLUSTER]) {
    expect(cfg.clusterRadius).toBeGreaterThan(0);
    expect(cfg.clusterMaxZoom).toBeGreaterThan(0);
    expect(cfg.clusterMaxZoom).toBeLessThan(18); // map maxZoom — clusters fully split before then
  }
});

test("clusterRadiusForCount picks the largest tier whose min ≤ count", () => {
  expect(clusterRadiusForCount(1)).toBe(15); // base tier
  expect(clusterRadiusForCount(24)).toBe(15);
  expect(clusterRadiusForCount(25)).toBe(19); // boundary, inclusive
  expect(clusterRadiusForCount(99)).toBe(19);
  expect(clusterRadiusForCount(100)).toBe(24);
  expect(clusterRadiusForCount(749)).toBe(24);
  expect(clusterRadiusForCount(750)).toBe(30);
  expect(clusterRadiusForCount(13_000)).toBe(30);
});

test("radius tiers are strictly ascending in both min and radius (monotonic ramp)", () => {
  for (let i = 1; i < CLUSTER_RADIUS_TIERS.length; i++) {
    expect(CLUSTER_RADIUS_TIERS[i][0]).toBeGreaterThan(CLUSTER_RADIUS_TIERS[i - 1][0]);
    expect(CLUSTER_RADIUS_TIERS[i][1]).toBeGreaterThan(CLUSTER_RADIUS_TIERS[i - 1][1]);
  }
});

test("nextClusterZoom never zooms out and always makes progress", () => {
  expect(nextClusterZoom(8, 5)).toBe(8); // expansion zoom ahead → use it
  expect(nextClusterZoom(5, 5)).toBe(5.5); // max-zoom cluster → nudge in by 0.5
  expect(nextClusterZoom(3, 6)).toBe(6.5); // never go backwards
});

test("planes are NOT clustered — plane features never carry a point_count", () => {
  const fc = toPlaneFC([
    { kind: "plane", id: "plane:abc", lat: 51, lon: 0, label: "BAW1", heading: 90 },
    { kind: "plane", id: "plane:def", lat: 51.1, lon: 0.1, label: "BAW2", heading: 180 },
  ]);
  for (const f of fc.features) {
    expect(f.properties).not.toHaveProperty("point_count");
    expect(f.properties).not.toHaveProperty("cluster_id");
  }
});
