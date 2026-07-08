import { expect, test } from "vitest";
import { parseAdsb, aircraftToWorldObject } from "@/lib/sources/adsb";

const rows = [
  { hex: "abc123", flight: "BAW123 ", lat: 51.5, lon: -0.1, alt_baro: 37000, gs: 450, track: 90, baro_rate: 0, category: "A5", t: "B77W", r: "G-XYZ" },
  { hex: "def456", flight: "HELI1", lat: 51.4, lon: -0.2, alt_baro: 1200, gs: 60, track: 10, category: "A7", t: "EC35" },
  { hex: "ghi789", flight: "TAXI", lat: 51.47, lon: -0.45, alt_baro: "ground", gs: 12, track: 0, category: "A3" },
  { hex: "nopos", flight: "NOFIX", alt_baro: 10000 }, // no lat/lon → skipped
];

test("parseAdsb skips rows without a position and converts units", () => {
  const ac = parseAdsb(rows as never);
  expect(ac).toHaveLength(3);
  const baw = ac[0];
  expect(baw.altKm).toBeCloseTo(37000 * 0.0003048, 3); // ft → km
  expect(baw.velocityMs).toBeCloseTo(450 * 0.514444, 1); // kt → m/s
  expect(ac[2].onGround).toBe(true); // alt_baro "ground"
});

test("captures squawk (activates emergency-squawk alerts)", () => {
  const [a] = parseAdsb([{ hex: "abc", flight: "TEST123", lat: 51, lon: 0, alt_baro: 30000, squawk: "7700" }] as never);
  expect(a.squawk).toBe("7700");
});

test("aircraftToWorldObject classifies from the ADS-B category", () => {
  const [heavy, heli, ground] = parseAdsb(rows as never).map(aircraftToWorldObject);
  expect(heavy.icon).toBe("plane-airliner"); // A5 heavy
  expect(heli.icon).toBe("plane-helicopter"); // A7 rotorcraft
  expect(ground.icon).toBe("plane-ground"); // on ground overrides
  expect(heavy.meta?.categorySource).toBe("adsb");
  expect(heavy.meta?.typeCode).toBe("B77W");
});

test("categorySource is honest — an emitter code classifyPlane doesn't trust reads as 'estimate'", () => {
  // A6 (high-performance) is a real ADS-B code but NOT in ADSB_CATEGORY, so the type is
  // an estimate from the flight profile — the provenance flag must say so, not "adsb".
  const [a] = parseAdsb([{ hex: "a6", flight: "FAST1", lat: 51, lon: 0, alt_baro: 35000, gs: 500, track: 90, category: "A6" }] as never).map(aircraftToWorldObject);
  expect(a.meta?.categorySource).toBe("estimate");
});
