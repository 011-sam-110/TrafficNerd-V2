import { describe, it, expect } from "vitest";
import { computeDive, DIVE_DURATION } from "@/lib/cinematic/dive";

describe("computeDive", () => {
  it("centers on the target as [lon, lat]", () => {
    const p = computeDive({ lat: 51.5, lon: -0.12 });
    expect(p.center).toEqual([-0.12, 51.5]);
  });
  it("clamps zoom into the street range [12, 16]", () => {
    const p = computeDive({ lat: 0, lon: 0 });
    expect(p.zoom).toBeGreaterThanOrEqual(12);
    expect(p.zoom).toBeLessThanOrEqual(16);
  });
  it("keeps pitch within [0, 60] and bearing 0", () => {
    const p = computeDive({ lat: 0, lon: 0 });
    expect(p.pitch).toBeGreaterThanOrEqual(0);
    expect(p.pitch).toBeLessThanOrEqual(60);
    expect(p.bearing).toBe(0);
  });
  it("clamps latitude to the web-mercator-safe ±85", () => {
    expect(computeDive({ lat: 89, lon: 0 }).center[1]).toBeCloseTo(85);
    expect(computeDive({ lat: -89, lon: 0 }).center[1]).toBeCloseTo(-85);
  });
  it("wraps longitude into [-180, 180)", () => {
    expect(computeDive({ lat: 0, lon: 200 }).center[0]).toBeCloseTo(-160);
  });
  it("uses the standard dive duration", () => {
    expect(computeDive({ lat: 0, lon: 0 }).duration).toBe(DIVE_DURATION);
  });
});
