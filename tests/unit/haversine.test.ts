import { expect, test } from "vitest";
import { haversineKm } from "@/lib/geo/haversine";

test("zero distance for identical points", () => {
  expect(haversineKm(51.5, -0.1, 51.5, -0.1)).toBeCloseTo(0, 5);
});

test("one degree of longitude at the equator is ~111.19 km", () => {
  expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
});

test("London Eye to Tower Bridge is ~3.07 km", () => {
  // London Eye (51.5033,-0.1196) -> Tower Bridge (51.5055,-0.0754)
  expect(haversineKm(51.5033, -0.1196, 51.5055, -0.0754)).toBeCloseTo(3.07, 0);
});
