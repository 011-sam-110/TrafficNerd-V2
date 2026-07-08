import { describe, it, expect } from "vitest";
import { parseElements } from "@/lib/satellites/elements";

// A real ISS (ZARYA) TLE. Mean motion ~15.5 rev/day → ~92-93 min, LEO ~400-420 km.
const L1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005";
const L2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377579  1234";

describe("parseElements", () => {
  it("parses inclination / eccentricity / mean motion and derives period + apogee/perigee", () => {
    const e = parseElements(L1, L2)!;
    expect(e).not.toBeNull();
    expect(Math.round(e.inclinationDeg * 10) / 10).toBe(51.6);
    expect(e.eccentricity).toBeCloseTo(0.0006703, 6);
    expect(Math.round(e.meanMotionRevPerDay)).toBe(16); // ~15.5 → rounds to 16
    expect(Math.round(e.periodMin)).toBe(93);           // 1440 / 15.50 ≈ 92.9
    expect(e.perigeeKm).toBeGreaterThan(380);
    expect(e.apogeeKm).toBeLessThan(430);
  });
  it("returns null on a malformed line", () => {
    expect(parseElements("", "garbage")).toBeNull();
  });
});
