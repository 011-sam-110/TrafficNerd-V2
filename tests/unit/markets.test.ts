import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/coingecko-markets.json";
import { parseMarkets, formatPrice } from "@/lib/markets";

test("parses CoinGecko rows, skipping id-less and price-less rows", () => {
  const out = parseMarkets(fixture as never);
  expect(out.map((a) => a.id)).toEqual(["bitcoin", "ethereum", "dogecoin"]);
});

test("normalises symbol, price, signed change and market cap", () => {
  const [btc, eth, doge] = parseMarkets(fixture as never);
  expect(btc.symbol).toBe("BTC");
  expect(btc.name).toBe("Bitcoin");
  expect(btc.price).toBe(60155);
  expect(btc.changePct24h).toBe(0.8); // rounded to 2dp
  expect(btc.marketCap).toBe(1206254726310);

  expect(eth.changePct24h).toBe(-2.1); // negative preserved
  expect(doge.changePct24h).toBeNull(); // upstream null → null (not 0)
  expect(doge.image).toBeUndefined(); // missing image omitted
});

test("formatPrice picks sensible precision and is calm (no neon symbols)", () => {
  expect(formatPrice(60155)).toBe("$60,155.00");
  expect(formatPrice(1.056)).toBe("$1.06");
  expect(formatPrice(0.075637)).toBe("$0.0756");
});

test("non-array input is safe", () => {
  expect(parseMarkets(null)).toEqual([]);
  expect(parseMarkets(undefined)).toEqual([]);
});
