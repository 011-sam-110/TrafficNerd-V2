import { describe, it, expect } from "vitest";
import { ADSB_GRID, capAircraft } from "@/lib/sources/adsb";
import type { WorldObject } from "@/lib/world";

describe("ADSB_GRID", () => {
  it("is a coarse worldwide grid within adsb.lol's point+radius limits", () => {
    expect(ADSB_GRID.length).toBeGreaterThanOrEqual(20);
    for (const c of ADSB_GRID) {
      expect(c.distNm).toBeLessThanOrEqual(250); // adsb.lol max radius
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lon).toBeGreaterThanOrEqual(-180);
      expect(c.lon).toBeLessThanOrEqual(180);
    }
  });

  it("spans multiple continents (not clustered in one hemisphere)", () => {
    expect(ADSB_GRID.some((c) => c.lon < -50)).toBe(true); // Americas
    expect(ADSB_GRID.some((c) => c.lon > 90)).toBe(true); // Asia/Oceania
    expect(ADSB_GRID.some((c) => c.lat < 0)).toBe(true); // southern hemisphere
  });
});

describe("capAircraft", () => {
  const mk = (id: string, onGround: boolean): WorldObject =>
    ({ kind: "plane", id, lat: 0, lon: 0, label: id, meta: { onGround } } as unknown as WorldObject);

  it("returns everything when under the cap", () => {
    const objs = [mk("a", false), mk("b", true)];
    expect(capAircraft(objs, 10)).toHaveLength(2);
  });

  it("caps to the limit and drops ground aircraft before airborne", () => {
    const objs = [mk("g1", true), mk("a1", false), mk("a2", false), mk("g2", true)];
    const out = capAircraft(objs, 2);
    expect(out).toHaveLength(2);
    expect(out.every((o) => (o.meta as { onGround?: boolean }).onGround === false)).toBe(true);
  });
});
