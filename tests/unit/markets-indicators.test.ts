import { describe, it, expect } from "vitest";
import { yahooParamsFor, sliceRecent, type Candle } from "@/lib/markets/chart";
import { sma, bollinger, rsi, volumeProfile, pointOfControl, rescaleShape, anomalyFlags } from "@/lib/markets/indicators";

/** Build candles at 1-minute spacing from a list of closes (o=h=l=c for simplicity). */
function candlesFrom(closes: number[], stepMs = 60_000, vols?: number[]): Candle[] {
  return closes.map((c, i) => ({ t: i * stepMs, o: c, h: c, l: c, c, v: vols?.[i] ?? 1 }));
}

describe("yahooParamsFor / timeframes", () => {
  it("maps intraday windows to a Yahoo range+interval with a trailing slice", () => {
    expect(yahooParamsFor("1h")).toEqual({ range: "1d", interval: "2m", sliceMs: 3_600_000 });
    expect(yahooParamsFor("1d")).toEqual({ range: "1d", interval: "5m", sliceMs: 86_400_000 });
    expect(yahooParamsFor("1w").interval).toBe("30m");
  });
  it("maps long windows with no slice", () => {
    expect(yahooParamsFor("1y")).toEqual({ range: "1y", interval: "1wk" });
    expect(yahooParamsFor("6mo").sliceMs).toBeUndefined();
  });
});

describe("sliceRecent", () => {
  it("keeps only candles within `ms` of the last one", () => {
    const c = candlesFrom([1, 2, 3, 4, 5], 60_000); // 0..4 min
    const last2 = sliceRecent(c, 60_000); // last minute → t>=240000 → indices 4 and (>=240000)… only idx4? cutoff=240000
    expect(last2.map((k) => k.c)).toEqual([4, 5]); // t=180000(idx3) and 240000(idx4) >= 240000-60000=180000
  });
  it("falls back to the whole series when the window leaves <2 bars", () => {
    const c = candlesFrom([1, 2, 3], 60_000);
    expect(sliceRecent(c, 1).length).toBe(3); // 1ms window → <2 → whole series
  });
  it("no-ops without a slice window", () => {
    const c = candlesFrom([1, 2, 3]);
    expect(sliceRecent(c, undefined)).toBe(c);
  });
});

describe("sma", () => {
  it("nulls until the window fills, then averages", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
});

describe("bollinger", () => {
  it("collapses to the price on a flat series (σ=0)", () => {
    const b = bollinger([10, 10, 10, 10], 3);
    expect(b[0]).toEqual({ mid: null, upper: null, lower: null });
    expect(b[2]).toEqual({ mid: 10, upper: 10, lower: 10 });
  });
  it("brackets the mean by mult·σ", () => {
    const b = bollinger([2, 4, 6], 3, 2); // mean 4, popσ = sqrt(8/3)
    const sd = Math.sqrt(8 / 3);
    expect(b[2].mid).toBeCloseTo(4);
    expect(b[2].upper).toBeCloseTo(4 + 2 * sd);
    expect(b[2].lower).toBeCloseTo(4 - 2 * sd);
  });
});

describe("rsi", () => {
  it("is 100 for a monotonically rising series (no losses)", () => {
    const r = rsi(Array.from({ length: 20 }, (_, i) => i + 1), 14);
    expect(r.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(r[14]).toBe(100);
    expect(r[19]).toBe(100);
  });
  it("is dormant-safe below the minimum sample count", () => {
    expect(rsi([1, 2, 3], 14).every((v) => v === null)).toBe(true);
  });
});

describe("volumeProfile / pointOfControl", () => {
  it("buckets volume by price and finds the point of control", () => {
    // Prices 10 and 20; the 20-level carries the most volume.
    const c: Candle[] = [
      { t: 0, o: 10, h: 10, l: 10, c: 10, v: 5 },
      { t: 1, o: 20, h: 20, l: 20, c: 20, v: 50 },
      { t: 2, o: 20, h: 20, l: 20, c: 20, v: 50 },
    ];
    const prof = volumeProfile(c, 10);
    expect(prof.length).toBe(10);
    const total = prof.reduce((s, b) => s + b.volume, 0);
    expect(total).toBe(105);
    const poc = pointOfControl(prof);
    expect(prof[poc].hi).toBeGreaterThan(19); // the top bin holds the 100 units at price 20
  });
  it("is empty for no candles", () => {
    expect(volumeProfile([], 10)).toEqual([]);
    expect(pointOfControl([])).toBe(-1);
  });
});

describe("rescaleShape", () => {
  it("min-max maps a series into the target range", () => {
    expect(rescaleShape([0, 5, 10], 0, 100)).toEqual([0, 50, 100]);
  });
  it("centres a flat series", () => {
    expect(rescaleShape([7, 7, 7], 0, 100)).toEqual([50, 50, 50]);
  });
});

describe("anomalyFlags", () => {
  it("flags an abrupt outlier move with its real % and direction", () => {
    // 9 calm ~+1% steps, then one ~+20% jump.
    const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 130];
    const flags = anomalyFlags(candlesFrom(closes), 2);
    expect(flags.length).toBeGreaterThanOrEqual(1);
    const jump = flags[flags.length - 1];
    expect(jump.up).toBe(true);
    expect(jump.pct).toBeGreaterThan(15);
    expect(jump.idx).toBe(9);
  });
  it("returns nothing for a short or flat series", () => {
    expect(anomalyFlags(candlesFrom([1, 2, 3]))).toEqual([]);
    expect(anomalyFlags(candlesFrom([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]))).toEqual([]);
  });
});
