import { describe, it, expect } from "vitest";
import { opsSummary, altitudeBand, regionOf, sortFlights } from "@/lib/planes/ops";
import type { WorldObject } from "@/lib/world";

const plane = (over: Partial<WorldObject> & { meta?: Record<string, unknown> }): WorldObject =>
  ({ kind: "plane", id: "plane:x", lat: 51, lon: 0, label: "T", ...over } as WorldObject);

describe("opsSummary", () => {
  it("splits airborne/ground, counts categories, tracks maxima", () => {
    const s = opsSummary([
      plane({ altKm: 10, meta: { category: "airliner", velocityMs: 250, onGround: false } }),
      plane({ altKm: 0, meta: { category: "ground", onGround: true, velocityMs: 5 } }),
    ]);
    expect(s.total).toBe(2);
    expect(s.airborne).toBe(1);
    expect(s.ground).toBe(1);
    expect(s.maxAltKm).toBe(10);
    expect(s.maxSpeedMs).toBe(250);
    expect(s.byCategory.find((c) => c.category === "airliner")!.count).toBe(1);
  });
});

describe("altitudeBand", () => {
  it("bands by altitude, ground first", () => {
    expect(altitudeBand(plane({ altKm: 9, meta: { onGround: false } }))).toBe("7–11 km");
    expect(altitudeBand(plane({ meta: { onGround: true } }))).toBe("ground");
  });
});

describe("regionOf", () => {
  it("maps coords to a coarse continent bucket", () => {
    expect(regionOf(51.5, -0.1)).toBe("Europe"); // London
    expect(regionOf(37, -120)).toBe("North America"); // California
    expect(regionOf(35.6, 139.8)).toBe("Asia"); // Tokyo
    expect(regionOf(-33.9, 151.2)).toBe("Oceania"); // Sydney
    expect(regionOf(25.2, 55.3)).toBe("Middle East"); // Dubai
    expect(regionOf(-23.5, -46.6)).toBe("South America"); // São Paulo
  });
});

describe("sortFlights", () => {
  it("sorts by altitude descending with dir -1", () => {
    const out = sortFlights([plane({ id: "a", altKm: 1 }), plane({ id: "b", altKm: 9 })], "altitude", -1);
    expect(out[0].id).toBe("b");
  });
});
