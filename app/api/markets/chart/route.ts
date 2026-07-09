import { parseYahooSeries, sliceRecent, yahooParamsFor, RANGES, type Candle, type Range, type YahooChartResponse } from "@/lib/markets/chart";

export const dynamic = "force-dynamic";

// GET /api/markets/chart?symbol=<yahoo>&range=1mo|6mo|1y — keyless Yahoo v8 OHLC
// for the Markets focus view's primary historical chart. Mirrors the dormant-safe
// pattern of /api/markets: a private getJson swallows every upstream error and a
// small per-`symbol:range` cache shields Yahoo. It NEVER 5xxes: a bad/blocked
// symbol, an out-of-range window, or an upstream failure all resolve to
// `{ candles: [] }`, and the view falls back to its accumulated live series.

const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";
const CACHE_TTL_MS = 5 * 60_000; // 5 min — history barely moves intraday
// Yahoo tickers: optional leading ^ (indices), then letters/digits + . = - (e.g. BZ=F, ^VIX, BRK-B).
const SYMBOL_RE = /^\^?[A-Za-z0-9.=-]{1,20}$/;

async function getJson<T>(url: string, ms = 12_000): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const CACHE_MAX = 200; // bound the cache so a flood of distinct attacker-supplied symbols can't grow it unbounded
const cache = new Map<string, { at: number; candles: Candle[] }>();

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  const rangeParam = (url.searchParams.get("range") ?? "6mo").trim();

  // Validate before touching the network — reject noise with an empty result, not a 5xx.
  if (!symbol || !SYMBOL_RE.test(symbol) || !(RANGES as string[]).includes(rangeParam)) {
    return Response.json({ candles: [] });
  }
  const range = rangeParam as Range;

  // Yahoo tickers are case-insensitive; normalise so "aapl"/"AAPL" share one cache slot.
  const key = `${symbol.toUpperCase()}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json({ candles: hit.candles });
  }

  // Map our timeframe → Yahoo (range, interval); intraday windows over-fetch a day
  // and are trimmed to their trailing span (Yahoo has no native "last hour" range).
  const { range: yRange, interval, sliceMs } = yahooParamsFor(range);
  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${encodeURIComponent(yRange)}&interval=${encodeURIComponent(interval)}`;
  const json = await getJson<YahooChartResponse>(yahooUrl);
  const candles = sliceRecent(parseYahooSeries(json), sliceMs);
  // Only cache a non-empty result so a transient upstream blip doesn't pin an empty
  // series for 5 minutes; empties simply retry next request.
  if (candles.length > 0) {
    cache.set(key, { at: Date.now(), candles });
    // Evict the oldest entry (Map preserves insertion order) once over the cap.
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
  return Response.json({ candles });
}
