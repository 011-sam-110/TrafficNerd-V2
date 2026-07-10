import { describe, it, expect } from "vitest";
import {
  opsSummary, altitudeBand, regionOf, sortFlights,
  planeHex, matchesFlightQuery, filterFlights, isBizjetObject, EMPTY_FLIGHT_FILTER,
} from "@/lib/planes/ops";
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

describe("opsSummary bizjets", () => {
  it("counts business jets and the airborne subset by ICAO type", () => {
    const s = opsSummary([
      plane({ meta: { typeCode: "GLF6", onGround: false } }), // airborne bizjet
      plane({ meta: { typeCode: "C750", onGround: true } }),  // grounded bizjet
      plane({ meta: { typeCode: "A320", onGround: false } }), // airliner
    ]);
    expect(s.bizjets).toBe(2);
    expect(s.bizjetsAirborne).toBe(1);
  });
});

describe("planeHex", () => {
  it("recovers the hex from the plane:<hex> id", () => {
    expect(planeHex(plane({ id: "plane:ab12cd" }))).toBe("ab12cd");
    expect(planeHex(plane({ id: "weird" }))).toBe("weird");
  });
});

describe("matchesFlightQuery", () => {
  const o = plane({ id: "plane:abc123", label: "BAW117", meta: { registration: "G-STBA", typeCode: "B77W" } });
  it("matches callsign / registration / type / hex, case-insensitively", () => {
    expect(matchesFlightQuery(o, "baw")).toBe(true);
    expect(matchesFlightQuery(o, "g-stba")).toBe(true);
    expect(matchesFlightQuery(o, "b77w")).toBe(true);
    expect(matchesFlightQuery(o, "abc123")).toBe(true);
    expect(matchesFlightQuery(o, "  ")).toBe(true); // empty → everything
    expect(matchesFlightQuery(o, "zzz")).toBe(false);
  });
});

describe("filterFlights", () => {
  const jet = plane({ id: "plane:1", lat: 51.5, lon: -0.1, label: "NJE1", meta: { typeCode: "GLEX", onGround: false } });
  const liner = plane({ id: "plane:2", lat: 35.6, lon: 139.8, label: "JAL5", meta: { typeCode: "B788", onGround: false } });
  it("composes region + bizjet + query filters", () => {
    expect(filterFlights([jet, liner], EMPTY_FLIGHT_FILTER)).toHaveLength(2);
    expect(filterFlights([jet, liner], { ...EMPTY_FLIGHT_FILTER, bizjetOnly: true })).toEqual([jet]);
    expect(filterFlights([jet, liner], { ...EMPTY_FLIGHT_FILTER, region: "Asia" })).toEqual([liner]);
    expect(filterFlights([jet, liner], { ...EMPTY_FLIGHT_FILTER, query: "jal" })).toEqual([liner]);
  });
  it("isBizjetObject reads the type code", () => {
    expect(isBizjetObject(jet)).toBe(true);
    expect(isBizjetObject(liner)).toBe(false);
  });
});
