import { expect, test } from "vitest";
import { regionOf, groupByRegion, groupByType, REGIONS, TYPE_ORDER } from "@/lib/events/regions";
import type { NormalizedEvent, EventType } from "@/lib/events/model";

function ev(id: string, lat: number, lon: number, type: EventType = "quake"): NormalizedEvent {
  return {
    id, type, title: id, place: { name: id },
    geo: { lat, lon, precision: "EXACT" },
    occurredAt: null,
    severity: { tier: "S2", raw: 5 },
    source: { id: "x", label: "X", attribution: "X" },
    color: "#000",
  };
}

test("regionOf places well-known cities in the intuitive bucket", () => {
  expect(regionOf(35.68, 139.69)).toBe("asia");     // Tokyo
  expect(regionOf(51.5, -0.12)).toBe("eu");         // London
  expect(regionOf(30.04, 31.24)).toBe("mena");      // Cairo
  expect(regionOf(34.05, -118.24)).toBe("na");      // Los Angeles
  expect(regionOf(-23.55, -46.63)).toBe("latam");   // São Paulo
  expect(regionOf(-33.87, 151.2)).toBe("oceania");  // Sydney
  expect(regionOf(-1.29, 36.82)).toBe("africa");    // Nairobi
  expect(regionOf(-77.85, 166.67)).toBe("polar");   // McMurdo
});

test("regionOf never throws on malformed coords", () => {
  expect(regionOf(NaN, 10)).toBe("other");
  expect(regionOf(0, Infinity)).toBe("other");
  expect(regionOf(5, -150)).toBe("other"); // mid-Pacific, outside every box
});

test("groupByRegion returns non-empty buckets in REGIONS order with counts", () => {
  const rows = [
    ev("tokyo", 35.68, 139.69),
    ev("osaka", 34.69, 135.5),
    ev("london", 51.5, -0.12),
    ev("la", 34.05, -118.24),
  ];
  const groups = groupByRegion(rows);
  expect(groups.map((g) => g.key)).toEqual(["na", "eu", "asia"]); // REGIONS order
  const asia = groups.find((g) => g.key === "asia")!;
  expect(asia.events.length).toBe(2);
  expect(asia.label).toBe(REGIONS.find((r) => r.id === "asia")!.label);
});

test("groupByType returns non-empty buckets in TYPE_ORDER", () => {
  const rows = [
    ev("q1", 0, 0, "quake"),
    ev("c1", 0, 0, "cyclone"),
    ev("q2", 0, 0, "quake"),
  ];
  const groups = groupByType(rows);
  expect(groups.map((g) => g.key)).toEqual(["quake", "cyclone"]);
  expect(TYPE_ORDER.indexOf("quake")).toBeLessThan(TYPE_ORDER.indexOf("cyclone"));
  expect(groups[0].events.length).toBe(2);
});
