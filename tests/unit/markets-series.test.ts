import { describe, it, expect } from "vitest";
import { parseYahooSeries, candlesToPoints, periodChange, hiLo, type YahooChartResponse } from "@/lib/markets/chart";

const json: YahooChartResponse = {
  chart: { result: [ {
    timestamp: [1704067200, 1704153600, 1704240000],
    indicators: { quote: [ { open: [100, 102, null], high: [105, 106, 104], low: [99, 101, 100], close: [102, 104, null], volume: [10, 12, 0] } ] },
  } ] },
};

describe("parseYahooSeries", () => {
  it("zips timestamps + OHLC, drops null-close rows, converts to ms", () => {
    const c = parseYahooSeries(json);
    expect(c.length).toBe(2); // third row has null close → dropped
    expect(c[0]).toEqual({ t: 1704067200000, o: 100, h: 105, l: 99, c: 102, v: 10 });
  });
  it("is dormant-safe on missing data", () => {
    expect(parseYahooSeries(null)).toEqual([]);
    expect(parseYahooSeries({ chart: { result: null } })).toEqual([]);
  });
});

describe("derivations", () => {
  it("periodChange first→last close", () => {
    const c = parseYahooSeries(json);
    expect(periodChange(c).abs).toBe(2); // 104 - 102
    expect(Math.round(periodChange(c).pct * 100) / 100).toBe(1.96);
  });
  it("hiLo spans all candles", () => {
    expect(hiLo(parseYahooSeries(json))).toEqual({ hi: 106, lo: 99 });
  });
  it("candlesToPoints maps close to y", () => {
    expect(candlesToPoints(parseYahooSeries(json))[0]).toEqual({ x: 1704067200000, y: 102 });
  });
});
