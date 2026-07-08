import { describe, it, expect } from "vitest";
import { lonLatToTile, gibsTileUrl, gibsDate } from "@/lib/sources/gibs";

describe("gibs tile math", () => {
  it("maps (0,0) to the centre tile at each zoom", () => {
    expect(lonLatToTile(0, 0, 1)).toEqual({ x: 1, y: 1 });
    expect(lonLatToTile(-180, 85, 2)).toEqual({ x: 0, y: 0 });
  });
  it("clamps out-of-range into valid tile indices", () => {
    const t = lonLatToTile(200, -95, 1); // beyond bounds
    expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x).toBeLessThanOrEqual(1);
    expect(t.y).toBeGreaterThanOrEqual(0); expect(t.y).toBeLessThanOrEqual(1);
  });
  it("builds a keyless GIBS URL for a sub-point", () => {
    const url = gibsTileUrl(51.5, -0.1, 3, "2026-07-07");
    expect(url).toContain("gibs.earthdata.nasa.gov");
    expect(url).toContain("/2026-07-07/");
    expect(url).toMatch(/\/3\/\d+\/\d+\.jpg$/);
  });
  it("gibsDate is UTC yesterday", () => {
    expect(gibsDate(Date.parse("2026-07-08T00:00:00Z"))).toBe("2026-07-07");
  });
});
