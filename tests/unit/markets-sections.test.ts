import { expect, test } from "vitest";
import {
  parseFx,
  parseEquities,
  parseMacro,
  macroRowFromYahoo,
  cryptoRows,
  formatCompactUsd,
  type MarketAsset,
} from "@/lib/markets";
import { buildBriefPrompt, parseBriefResponse } from "@/lib/brief";

test("parseFx maps ECB rates to per-USD rows (live shape)", () => {
  // Real Frankfurter response shape.
  const out = parseFx({ base: "USD", date: "2026-06-26", rates: { EUR: 0.87712, GBP: 0.75654, JPY: 161.65, BAD: 0 } });
  expect(out).toHaveLength(3); // the zero rate is dropped
  const eur = out.find((r) => r.id === "fx:EUR")!;
  expect(eur.name).toBe("Euro");
  expect(eur.symbol).toBe("USD/EUR");
  expect(eur.sub).toContain("2026-06-26");
  expect(eur.changePct).toBeUndefined(); // FX latest carries no change
  expect(parseFx(null)).toEqual([]);
  expect(parseFx({})).toEqual([]);
});

test("parseEquities keeps real quotes, drops empty/zero prices", () => {
  const out = parseEquities([
    { symbol: "spy", name: "S&P 500 (SPY)", c: 612.4, dp: 0.83 },
    { symbol: "AAPL", name: "Apple", c: 0, dp: 0 }, // zero price → dropped
    { symbol: "", name: "x", c: 10, dp: 1 }, // no symbol → dropped
  ]);
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe("eq:SPY");
  expect(out[0].symbol).toBe("SPY");
  expect(out[0].changePct).toBe(0.83);
});

test("parseMacro formats latest observations with units", () => {
  const out = parseMacro([
    { id: "DGS10", label: "10-Yr Treasury", value: 4.23, unit: "%", date: "2026-06-26" },
    { id: "VIXCLS", label: "VIX (volatility)", value: 13.8, unit: "", date: "2026-06-26" },
    { id: "BAD", label: "missing", value: null }, // "." sentinel → dropped
  ]);
  expect(out).toHaveLength(2);
  expect(out.find((r) => r.id === "macro:DGS10")!.value).toBe("4.23%");
  expect(out.find((r) => r.id === "macro:VIXCLS")!.value).toBe("13.8");
});

test("macroRowFromYahoo formats a yield index with its unit + day change (keyless)", () => {
  const json = { chart: { result: [{ meta: { regularMarketPrice: 4.561, chartPreviousClose: 4.569 } }] } };
  const row = macroRowFromYahoo(json, { y: "^TNX", symbol: "US 10Y", name: "US 10-Yr Treasury Yield", unit: "%" });
  expect(row!.value).toBe("4.56%");
  expect(row!.num).toBe(4.561);
  expect(row!.changePct).toBe(-0.18); // (4.561-4.569)/4.569*100
  expect(row!.chartSymbol).toBe("^TNX"); // chartable history
  expect(macroRowFromYahoo(null, { y: "^TNX", symbol: "x", name: "x", unit: "%" })).toBeNull();
});

test("cryptoRows carries market cap as a compact sub-line", () => {
  const assets: MarketAsset[] = [
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 60155, changePct24h: 1.2, marketCap: 1_190_000_000_000 },
  ];
  const rows = cryptoRows(assets);
  expect(rows[0].value).toBe("$60,155.00");
  expect(rows[0].sub).toBe("mkt cap $1.2T");
});

test("formatCompactUsd scales T/B/M", () => {
  expect(formatCompactUsd(1_190_000_000_000)).toBe("$1.2T");
  expect(formatCompactUsd(845_000_000_000)).toBe("$845.0B");
  expect(formatCompactUsd(12_300_000)).toBe("$12.3M");
});

test("buildBriefPrompt is grounded and forbids speculation", () => {
  const prompt = buildBriefPrompt({
    topInstability: [
      { country: "Afghanistan", score: 49 },
      { country: "Somalia", score: 49 },
    ],
    dateIso: "2026-06-27",
  });
  expect(prompt).toContain("Afghanistan (49/100)");
  expect(prompt).toContain("Somalia (49/100)");
  expect(prompt).toContain("2026-06-27");
  expect(prompt.toLowerCase()).toContain("do not invent");
  // Empty snapshot still produces a safe prompt.
  expect(buildBriefPrompt({ topInstability: [] })).toContain("no countries currently above");
});

test("parseBriefResponse pulls the message content, or null", () => {
  expect(parseBriefResponse({ choices: [{ message: { content: "  Global pressure is concentrated…  " } }] })).toBe(
    "Global pressure is concentrated…",
  );
  expect(parseBriefResponse({ choices: [] })).toBeNull();
  expect(parseBriefResponse({})).toBeNull();
  expect(parseBriefResponse(null)).toBeNull();
});
