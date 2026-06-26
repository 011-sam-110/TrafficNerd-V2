import { describe, it, expect } from "vitest";
import { parseTle } from "@/lib/sources/celestrak";
import {
  buildSatrec,
  propagateAt,
  meanMotionRevPerDay,
  orbitalPeriodMin,
} from "@/lib/satellites/propagate";

// Real ISS TLE (CelesTrak, 2026-06-25 epoch).
const ISS_L1 = "1 25544U 98067A   26176.70356236  .00009385  00000+0  17567-3 0  9997";
const ISS_L2 = "2 25544  51.6325 257.9368 0004376 231.2480 128.8118 15.49425151573072";

// Two satellites, with trailing whitespace on the name lines and a trailing blank
// line — exactly the shape CelesTrak's FORMAT=tle emits.
const FIXTURE = [
  "ISS (ZARYA)             ",
  ISS_L1,
  ISS_L2,
  "POISK                   ",
  "1 36086U 09060A   26176.70356236  .00009385  00000+0  17567-3 0  9995",
  "2 36086  51.6325 257.9368 0004376 231.2480 128.8118 15.49425151589960",
  "",
].join("\n");

describe("parseTle", () => {
  it("parses 3-line triplets, trimming names and extracting the NORAD id", () => {
    const recs = parseTle(FIXTURE);
    expect(recs).toHaveLength(2);
    expect(recs[0].name).toBe("ISS (ZARYA)");
    expect(recs[0].noradId).toBe("25544");
    expect(recs[0].line1).toBe(ISS_L1);
    expect(recs[0].line2).toBe(ISS_L2);
    expect(recs[1].noradId).toBe("36086");
  });

  it("returns [] for empty/blank input without throwing", () => {
    expect(parseTle("")).toEqual([]);
    expect(parseTle("\n\n")).toEqual([]);
  });
});

describe("propagateAt (ISS)", () => {
  const satrec = buildSatrec(ISS_L1, ISS_L2);
  const sp = propagateAt(satrec, new Date("2026-06-26T00:00:00Z"));

  it("returns a physically plausible sub-point", () => {
    expect(sp).not.toBeNull();
    if (!sp) return;
    expect(Math.abs(sp.lat)).toBeLessThanOrEqual(52); // ISS inclination 51.6°
    expect(sp.lon).toBeGreaterThanOrEqual(-180);
    expect(sp.lon).toBeLessThanOrEqual(180);
    expect(sp.altKm).toBeGreaterThan(380); // ISS ~400–420 km
    expect(sp.altKm).toBeLessThan(460);
    expect(sp.velocityKmS).toBeGreaterThan(7.4); // ~7.66 km/s
    expect(sp.velocityKmS).toBeLessThan(7.9);
  });
});

describe("orbital period", () => {
  it("derives mean motion + period from the TLE", () => {
    expect(meanMotionRevPerDay(ISS_L2)).toBeCloseTo(15.49425151, 5);
    const period = orbitalPeriodMin(ISS_L2);
    expect(period).toBeGreaterThan(90);
    expect(period).toBeLessThan(95);
  });
});
