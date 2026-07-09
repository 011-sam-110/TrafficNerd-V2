import { parseYahooSeries, type YahooChartResponse } from "@/lib/markets/chart";

export const dynamic = "force-dynamic";

// GET /api/markets/ath?symbols=BTC-USD,SPY,BZ=F — keyless all-time-high per symbol,
// from Yahoo v8 monthly candles over range=max (the max monthly high ≈ ATH; honest
// monthly resolution, labelled as such in the UI). Dormant-safe: any failure /
// unknown symbol is simply omitted from the map, never a 5xx. Hard-cached per
// symbol (ATH barely moves) so the table can enrich itself without hammering Yahoo.

const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";
const CACHE_TTL_MS = 6 * 60 * 60_000; // 6h — an all-time high changes rarely
const SYMBOL_RE = /^\^?[A-Za-z0-9.=-]{1,20}$/;
const MAX_SYMBOLS = 40;
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; ath: number }>();

async function getJson<T>(url: string, ms = 12_000): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function athFor(symbol: string): Promise<number | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ath;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=1mo`;
  const candles = parseYahooSeries(await getJson<YahooChartResponse>(url));
  if (candles.length === 0) return null;
  let hi = -Infinity;
  for (const k of candles) if (k.h > hi) hi = k.h;
  if (!Number.isFinite(hi)) return null;
  cache.set(symbol, { at: Date.now(), ath: hi });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return hi;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const symbols = Array.from(
    new Set((url.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s))),
  ).slice(0, MAX_SYMBOLS);
  const entries = await Promise.all(symbols.map(async (s) => [s, await athFor(s)] as const));
  const ath: Record<string, number> = {};
  for (const [s, v] of entries) if (v != null) ath[s] = v;
  return Response.json({ ath });
}
