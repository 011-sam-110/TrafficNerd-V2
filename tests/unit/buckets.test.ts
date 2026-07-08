// tests/unit/buckets.test.ts
import { describe, it, expect } from "vitest";
import { countBy, histogram, timeBins } from "@/lib/widgets/buckets";

describe("buckets", () => {
  it("countBy tallies by key", () => {
    expect(countBy(["a", "b", "a"], (s) => s)).toEqual({ a: 2, b: 1 });
  });

  it("histogram bins [lo,hi) with an inclusive last edge", () => {
    // edges 0,2,4,6 → bins [0,2) [2,4) [4,6]
    expect(histogram([0, 1, 2, 3, 4, 5, 6], [0, 2, 4, 6])).toEqual([2, 2, 3]);
  });

  it("timeBins buckets timestamps into fixed windows and ignores out-of-range", () => {
    const now = 1_000_000;
    const bins = timeBins([now - 1, now - 3500, now + 999], 1000, now, 3000);
    expect(bins).toHaveLength(3);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(1); // only now-1 is inside [now-3000, now]
    expect(bins[2].count).toBe(1);
  });
});
