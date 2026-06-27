import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/eonet-events.json";
import {
  eonetToFeatures,
  representativePoint,
  CATEGORIES,
  type EonetEvent,
} from "@/lib/signals/eonet";

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
