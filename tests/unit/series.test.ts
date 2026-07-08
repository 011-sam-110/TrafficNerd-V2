import { describe, it, expect, beforeEach } from "vitest";
import { recordSeries, seriesTrend, seriesSamples, __resetSeries } from "@/lib/series";

// In the node test env there is no window, so persistence is a no-op and the
// module keeps an in-memory map — enough to exercise record/read/cap behaviour.
beforeEach(() => __resetSeries());

describe("series store", () => {
  it("records samples and reads a normalized 0..1 trend", () => {
    recordSeries("mkt:x", 10, 1);
    recordSeries("mkt:x", 20, 2);
    recordSeries("mkt:x", 15, 3);
    const trend = seriesTrend("mkt:x", 24);
    expect(trend.length).toBe(3);
    expect(trend[0]).toBeCloseTo(0, 5); // min → 0
    expect(trend[1]).toBeCloseTo(1, 5); // max → 1
    expect(trend[2]).toBeCloseTo(0.5, 5);
    expect(seriesSamples("mkt:x").length).toBe(3);
  });

  it("collapses a flat tail (same value only advances time)", () => {
    recordSeries("mkt:y", 5, 1);
    recordSeries("mkt:y", 5, 2);
    expect(seriesSamples("mkt:y").length).toBe(1);
  });

  it("ignores non-finite values and keys are isolated", () => {
    recordSeries("mkt:z", Number.NaN, 1);
    recordSeries("mkt:z", 7, 2);
    expect(seriesSamples("mkt:z").length).toBe(1);
    expect(seriesSamples("mkt:absent")).toEqual([]);
  });

  it("caps stored samples per series", () => {
    for (let i = 0; i < 120; i++) recordSeries("mkt:c", i, i); // strictly increasing → no collapse
    expect(seriesSamples("mkt:c").length).toBeLessThanOrEqual(48);
  });
});
