import { describe, it, expect } from "vitest";
import { withinScope, radiusFromBbox, coerceSavedScope, WORLD_SCOPE, type Scope } from "@/lib/shell/scope";

describe("withinScope", () => {
  it("world admits everything", () => {
    expect(withinScope(80, 170, WORLD_SCOPE)).toBe(true);
  });
  it("near-me / region admit points inside the radius and reject those outside", () => {
    const s: Scope = { mode: "near-me", center: { lat: 51.5, lon: -0.12 }, radiusKm: 50, label: "Near me" };
    expect(withinScope(51.51, -0.13, s)).toBe(true);   // ~1 km away
    expect(withinScope(48.85, 2.35, s)).toBe(false);   // Paris, far outside
  });
  it("aoi admits points inside the bbox [west,south,east,north]", () => {
    const s: Scope = { mode: "aoi", bbox: [-1, 50, 1, 52], label: "AOI" };
    expect(withinScope(51, 0, s)).toBe(true);
    expect(withinScope(60, 0, s)).toBe(false);
  });
  it("falls back to admit-all on a malformed scope (never hide untestable data)", () => {
    expect(withinScope(0, 0, { mode: "near-me", label: "x" })).toBe(true);
    expect(withinScope(0, 0, { mode: "aoi", label: "x" })).toBe(true);
  });
});

describe("radiusFromBbox", () => {
  it("derives a sensible radius (km) from a place extent", () => {
    expect(radiusFromBbox([-0.5, 51.2, 0.3, 51.7])).toBeGreaterThan(20);
    expect(radiusFromBbox([-0.001, 51.5, 0.001, 51.501])).toBeGreaterThanOrEqual(10); // floor
  });
});

describe("coerceSavedScope", () => {
  it("rehydrates a persisted near-me back to World (never auto-geolocates)", () => {
    expect(coerceSavedScope({ mode: "near-me", center: { lat: 1, lon: 2 }, radiusKm: 50, label: "Near me" }))
      .toEqual(WORLD_SCOPE);
  });
  it("keeps a region scope", () => {
    const r: Scope = { mode: "region", center: { lat: 1, lon: 2 }, radiusKm: 100, label: "Berlin" };
    expect(coerceSavedScope(r)).toEqual(r);
  });
  it("returns World for junk", () => {
    expect(coerceSavedScope(null)).toEqual(WORLD_SCOPE);
    expect(coerceSavedScope({ nope: true })).toEqual(WORLD_SCOPE);
  });
});
