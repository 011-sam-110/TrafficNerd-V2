// tests/unit/map-inset.test.ts
import { describe, it, expect } from "vitest";
import { pointsToFC, boundsOf } from "@/lib/map/inset";

describe("inset map helpers", () => {
  it("pointsToFC builds [lon,lat] point features and drops non-finite coords", () => {
    const fc = pointsToFC([{ lat: 10, lon: 20, id: "a" }, { lat: NaN, lon: 5, id: "b" }]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({ type: "Point", coordinates: [20, 10] });
    expect(fc.features[0].properties).toMatchObject({ id: "a" });
  });

  it("boundsOf returns [[w,s],[e,n]] or null when empty", () => {
    expect(boundsOf([{ lat: 10, lon: 20 }, { lat: -5, lon: 40 }])).toEqual([[20, -5], [40, 10]]);
    expect(boundsOf([])).toBeNull();
  });
});
