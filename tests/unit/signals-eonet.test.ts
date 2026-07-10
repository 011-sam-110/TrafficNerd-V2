import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/eonet-events.json";
import {
  eonetToFeatures,
  representativePoint,
  CATEGORIES,
  SEVERE_STORMS_SOURCE,
  WILDFIRES_SOURCE,
  VOLCANOES_SOURCE,
  FLOODS_SOURCE,
  type EonetEvent,
} from "@/lib/signals/eonet";
import { rowMetric } from "@/lib/console/signals/signalCard";

const events = (fixture as { events: EonetEvent[] }).events;

test("filters to one category and skips events with no usable geometry", () => {
  const fires = eonetToFeatures(events, CATEGORIES.wildfires);
  // EONET_W1 (point) + EONET_WP (polygon) — EONET_NOGEOM has no geometry → skipped.
  expect(fires.map((f) => f.id)).toEqual(["eonet:EONET_W1", "eonet:EONET_WP"]);
  expect(fires.every((f) => f.signalId === "wildfires")).toBe(true);
});

test("maps the LATEST geometry point + surfaces intensity for storms", () => {
  const storms = eonetToFeatures(events, CATEGORIES.severeStorms);
  expect(storms).toHaveLength(1);
  const s = storms[0];
  expect(s.id).toBe("eonet:EONET_S1");
  expect(s.lon).toBeCloseTo(134.1, 3); // last track point, not the first
  expect(s.lat).toBeCloseTo(22.4, 3);
  expect(s.props?.intensity).toBe("50 kts");
  expect(s.ts).toBe("2026-06-25T18:00:00Z");
  // Wind magnitude is NOT exposed as `magnitude` (it must not drive marker radius).
  expect(s.props?.magnitude).toBeUndefined();
});

test("a polygon event pins to its averaged outer-ring centroid", () => {
  const fires = eonetToFeatures(events, CATEGORIES.wildfires);
  const poly = fires.find((f) => f.id === "eonet:EONET_WP")!;
  expect(poly.lon).toBeCloseTo(10.8, 6);
  expect(poly.lat).toBeCloseTo(20.8, 6);
});

test("representativePoint handles Point and Polygon, rejects junk", () => {
  expect(representativePoint({ type: "Point", coordinates: [5, 6] })).toEqual([5, 6]);
  expect(
    representativePoint({ type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4]]] }),
  ).toEqual([2, 2]);
  expect(representativePoint(undefined)).toBeNull();
  expect(representativePoint({ type: "Point", coordinates: [] })).toBeNull();
});

test("floods category yields nothing from this slice (dormant-safe empty)", () => {
  expect(eonetToFeatures(events, CATEGORIES.floods)).toEqual([]);
});

test("severe storms carry a numeric windKt scalar that resolves via the metric", () => {
  const storms = eonetToFeatures(events, CATEGORIES.severeStorms);
  const s = storms[0];
  // Sibling NUMERIC prop (alongside the "50 kts" display string) for the bar.
  expect(s.props?.windKt).toBe(50);
  expect(typeof s.props?.windKt).toBe("number");
  expect(Number.isFinite(s.props?.windKt as number)).toBe(true);

  // The source declares the metric and rowMetric resolves it for this feature.
  expect(SEVERE_STORMS_SOURCE.metric).toEqual({ field: "windKt", domain: [35, 140], unit: " kts" });
  const m = rowMetric(s, SEVERE_STORMS_SOURCE.metric);
  expect(m).toEqual({ value: 50, domain: [35, 140], label: "50 kts" });
});

test("categorical hazards (fires/volcanoes/floods) declare NO metric — honest dot", () => {
  expect(WILDFIRES_SOURCE.metric).toBeUndefined();
  expect(VOLCANOES_SOURCE.metric).toBeUndefined();
  expect(FLOODS_SOURCE.metric).toBeUndefined();
  // and their features carry no windKt scalar
  const fires = eonetToFeatures(events, CATEGORIES.wildfires);
  expect(fires.every((f) => f.props?.windKt === undefined)).toBe(true);
});
