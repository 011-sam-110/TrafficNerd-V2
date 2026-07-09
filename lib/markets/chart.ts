// Pure parsing/derivation for the Markets focus charts. The chart ROUTE fetches
// keyless Yahoo v8 OHLC; this module turns that JSON into candles + the derived
// figures the UI shows (period change, hi/lo), and projects candles to Chart points.
// Pure + isomorphic so it unit-tests against a captured fixture.

// Timeframe model. The UI exposes short intraday / mid / long windows; each maps
// to a Yahoo v8 (range, interval) pair. Intraday windows over-fetch a day and are
// sliced to the intended span (Yahoo has no native "last hour" range), so the data
// stays REAL — we window it, never synthesise it.
export type Range = "1h" | "1d" | "1w" | "1mo" | "6mo" | "1y";
export const RANGES: Range[] = ["1h", "1d", "1w", "1mo", "6mo", "1y"];
export const RANGE_LABEL: Record<Range, string> = {
  "1h": "1H", "1d": "1D", "1w": "1W", "1mo": "1M", "6mo": "6M", "1y": "1Y",
};

/** Yahoo (range, interval) + optional trailing-window slice for each timeframe. */
export interface YahooParams { range: string; interval: string; sliceMs?: number }
const HOUR = 3_600_000, DAY = 86_400_000, WEEK = 7 * DAY;
const TF: Record<Range, YahooParams> = {
  "1h": { range: "1d", interval: "2m", sliceMs: HOUR },
  "1d": { range: "1d", interval: "5m", sliceMs: DAY },
  "1w": { range: "5d", interval: "30m", sliceMs: WEEK },
  "1mo": { range: "1mo", interval: "1d" },
  "6mo": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1wk" },
};
/** Pure: our timeframe key → the Yahoo params the chart route requests. */
export function yahooParamsFor(range: Range): YahooParams {
  return TF[range] ?? TF["6mo"];
}

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

/** Pure: keep only candles within `ms` of the last candle (trailing-window slice).
 *  Used to turn an over-fetched intraday day into a "last hour / last day" view. */
export function sliceRecent(candles: Candle[], ms?: number): Candle[] {
  if (!ms || candles.length === 0) return candles;
  const cutoff = candles[candles.length - 1].t - ms;
  const windowed = candles.filter((k) => k.t >= cutoff);
  // Guard against a too-aggressive slice leaving <2 bars (sparse intraday): fall
  // back to the whole fetched series so the chart still renders something real.
  return windowed.length >= 2 ? windowed : candles;
}

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
