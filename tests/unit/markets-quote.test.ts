import { describe, it, expect } from "vitest";
import { parseYahooChart, type YahooChart, type QuoteSpec } from "@/lib/markets";

const SPEC: QuoteSpec = { symbol: "WTI", name: "Crude Oil (WTI)" };

function chart(price: number | null, prev: number | null): YahooChart {
  return { chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: prev } }] } };
}

describe("parseYahooChart", () => {
  it("uses price as value and day-over-day move (price vs previous close) as % change", () => {
    const row = parseYahooChart(chart(72.3, 70.44), SPEC)!;
    expect(row.symbol).toBe("WTI");
    expect(row.value).toBe("$72.30");
    expect(row.changePct).toBeCloseTo(2.64, 2); // (72.3-70.44)/70.44
  });

  it("emits a negative change when price fell", () => {
    const row = parseYahooChart(chart(747.71, 751.28), { symbol: "SPY", name: "S&P 500 (SPY)" })!;
    expect(row.changePct! < 0).toBe(true);
    expect(row.changePct).toBeCloseTo(-0.48, 2);
  });

  it("null change when previous close is missing, but still returns the price", () => {
    const row = parseYahooChart(chart(100, null), SPEC)!;
    expect(row.value).toBe("$100.00");
    expect(row.changePct).toBeNull();
  });

  it("is dormant-safe: bad/empty payloads yield null", () => {
    expect(parseYahooChart(null, SPEC)).toBeNull();
    expect(parseYahooChart({}, SPEC)).toBeNull();
    expect(parseYahooChart({ chart: { result: [] } }, SPEC)).toBeNull();
    expect(parseYahooChart(chart(0, 70), SPEC)).toBeNull(); // non-positive price
    expect(parseYahooChart(chart(null, 70), SPEC)).toBeNull();
  });
});
