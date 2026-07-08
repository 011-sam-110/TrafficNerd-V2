// Pure parsing/derivation for the Markets focus charts. The chart ROUTE fetches
// keyless Yahoo v8 OHLC; this module turns that JSON into candles + the derived
// figures the UI shows (period change, hi/lo), and projects candles to Chart points.
// Pure + isomorphic so it unit-tests against a captured fixture.

export type Range = "1mo" | "6mo" | "1y";
export const RANGES: Range[] = ["1mo", "6mo", "1y"];

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

interface YahooQuote { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }
interface YahooResult { timestamp?: number[]; indicators?: { quote?: YahooQuote[] } }
export interface YahooChartResponse { chart?: { result?: YahooResult[] | null; error?: unknown } }

/** Pure: Yahoo v8 chart JSON → candles (drops rows with a null close). t is epoch ms. */
export function parseYahooSeries(json: YahooChartResponse | null | undefined): Candle[] {
  const r = json?.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (typeof c !== "number" || !Number.isFinite(c)) continue; // holidays / gaps
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], v = q.volume?.[i];
    out.push({
      t: ts[i] * 1000,
      o: typeof o === "number" ? o : c,
      h: typeof h === "number" ? h : c,
      l: typeof l === "number" ? l : c,
      c,
      v: typeof v === "number" ? v : 0,
    });
  }
  return out;
}

export interface ChartPointLite { x: number; y: number }
/** Close-price line points (the default "actual graph"). */
export function candlesToPoints(candles: Candle[]): ChartPointLite[] {
  return candles.map((k) => ({ x: k.t, y: k.c }));
}

/** Absolute + percent change from first to last close; zeros on <2 candles. */
export function periodChange(candles: Candle[]): { abs: number; pct: number } {
  if (candles.length < 2) return { abs: 0, pct: 0 };
  const first = candles[0].c, last = candles[candles.length - 1].c;
  const abs = last - first;
  return { abs, pct: first !== 0 ? (abs / first) * 100 : 0 };
}

/** Min low / max high across the range (the "52-week" hi/lo when range=1y). */
export function hiLo(candles: Candle[]): { hi: number; lo: number } | null {
  if (candles.length === 0) return null;
  let hi = -Infinity, lo = Infinity;
  for (const k of candles) { if (k.h > hi) hi = k.h; if (k.l < lo) lo = k.l; }
  return { hi, lo };
}
