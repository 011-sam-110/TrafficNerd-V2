import { expect, test } from "vitest";
import { nearbyHubs, HUBS, HUB_TYPE_LABEL, type Hub } from "@/lib/events/hubs";
import type { NormalizedEvent } from "@/lib/events/model";

function ev(lat: number, lon: number): NormalizedEvent {
  return {
    id: "e", type: "quake", title: "e", place: { name: "e" },
    geo: { lat, lon, precision: "EXACT" }, occurredAt: null,
    severity: { tier: "S4", raw: 8 }, source: { id: "x", label: "X", attribution: "X" }, color: "#000",
  };
}

const HUBS_TEST: Hub[] = [
  { name: "A", type: "port", country: "X", lat: 0, lon: 0 },
  { name: "B", type: "airport", country: "X", lat: 0, lon: 1 },   // ~111 km east
  { name: "C", type: "manufacturing", country: "X", lat: 0, lon: 5 }, // ~556 km east
];

test("nearbyHubs returns hubs within radius, nearest first", () => {
  const near = nearbyHubs(ev(0, 0), 200, HUBS_TEST);
  expect(near.map((n) => n.hub.name)).toEqual(["A", "B"]); // C is out of range
  expect(near[0].distanceKm).toBeCloseTo(0, 3);
  expect(near[1].distanceKm).toBeGreaterThan(100);
});

test("a zero radius yields nothing", () => {
  expect(nearbyHubs(ev(0, 0.5), 0, HUBS_TEST)).toEqual([]);
});

test("the curated HUBS set is well-formed and non-trivial", () => {
  expect(HUBS.length).toBeGreaterThanOrEqual(40);
  for (const h of HUBS) {
    expect(typeof h.name).toBe("string");
    expect(h.lat).toBeGreaterThanOrEqual(-90);
    expect(h.lat).toBeLessThanOrEqual(90);
    expect(h.lon).toBeGreaterThanOrEqual(-180);
    expect(h.lon).toBeLessThanOrEqual(180);
    expect(HUB_TYPE_LABEL[h.type]).toBeTruthy();
  }
  // A real event near Rotterdam should surface the port from the FULL curated set.
  const names = nearbyHubs(ev(51.95, 4.14), 60).map((n) => n.hub.name);
  expect(names.some((n) => n.includes("Rotterdam"))).toBe(true);
});
