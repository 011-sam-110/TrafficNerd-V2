import { parseYahooSeries, RANGES, type Candle, type Range, type YahooChartResponse } from "@/lib/markets/chart";

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

// Weekly bars over a year keep the point count sane; daily for the shorter windows.
function intervalFor(range: Range): string {
  return range === "1y" ? "1wk" : "1d";
}

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

  const key = `${symbol}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json({ candles: hit.candles });
  }

  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${encodeURIComponent(range)}&interval=${intervalFor(range)}`;
  const json = await getJson<YahooChartResponse>(yahooUrl);
  const candles = parseYahooSeries(json);
  // Only cache a non-empty result so a transient upstream blip doesn't pin an empty
  // series for 5 minutes; empties simply retry next request.
  if (candles.length > 0) cache.set(key, { at: Date.now(), candles });
  return Response.json({ candles });
}
