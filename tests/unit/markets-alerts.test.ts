import { describe, it, expect } from "vitest";
import { crossed } from "@/lib/markets/alerts";

describe("crossed (edge-triggered price alert)", () => {
  it("fires an 'above' alert only on the upward crossing", () => {
    const a = { price: 100, dir: "above" as const };
    expect(crossed(a, 98, 101)).toBe(true);   // crossed up through 100
    expect(crossed(a, 101, 103)).toBe(false);  // already above → no re-fire
    expect(crossed(a, 103, 99)).toBe(false);   // moving down → not an 'above' hit
    expect(crossed(a, 100, 101)).toBe(false);  // was already at the level
  });
  it("fires a 'below' alert only on the downward crossing", () => {
    const a = { price: 50, dir: "below" as const };
    expect(crossed(a, 52, 49)).toBe(true);
    expect(crossed(a, 49, 48)).toBe(false);
    expect(crossed(a, 48, 51)).toBe(false);
  });
  it("is safe without a prior sample or with non-finite input", () => {
    expect(crossed({ price: 10, dir: "above" }, undefined, 11)).toBe(false);
    expect(crossed({ price: 10, dir: "above" }, NaN, 11)).toBe(false);
    expect(crossed({ price: 10, dir: "above" }, 9, NaN)).toBe(false);
  });
});
