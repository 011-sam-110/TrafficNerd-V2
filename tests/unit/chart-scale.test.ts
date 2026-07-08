// tests/unit/chart-scale.test.ts
import { describe, it, expect } from "vitest";
import { extent, linear } from "@/lib/chart/scale";

describe("chart scale", () => {
  it("extent returns [min,max], padding a flat series", () => {
    expect(extent([3, 1, 2])).toEqual([1, 3]);
    expect(extent([5, 5])).toEqual([4, 6]);
    expect(extent([])).toEqual([0, 1]);
  });

  it("linear maps domain onto range", () => {
    const s = linear([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  it("linear is flat when the domain is degenerate", () => {
    const s = linear([4, 4], [0, 100]);
    expect(s(4)).toBe(0);
  });
});
