import { parseMarkets, type CoinGeckoMarket, type MarketsPayload } from "@/lib/markets";

export const dynamic = "force-dynamic";

// GET /api/markets — calm crypto snapshot, proxied from CoinGecko (keyless,
// rate-limited). A short server cache (≥60s) shields the upstream from bursts;
// dormant-safe: any failure serves the last good snapshot, or an empty list,
// never a 5xx. No key is involved — this is the free public endpoint.

const ENDPOINT =
  "https://api.coingecko.com/api/v3/coins/markets" +
  "?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,cardano,dogecoin,binancecoin,tron" +
  "&order=market_cap_desc&price_change_percentage=24h";

const CACHE_TTL_MS = 60_000;

let cache: MarketsPayload | null = null;

export async function GET() {
  if (cache && Date.now() - cache.generatedAt < CACHE_TTL_MS) {
    return Response.json(cache);
  }
  try {
    const res = await fetch(ENDPOINT, {
      headers: {
        "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
    const rows = (await res.json()) as CoinGeckoMarket[];
    cache = { generatedAt: Date.now(), assets: parseMarkets(rows) };
  } catch {
    // Serve the last good snapshot if we have one; otherwise an empty (dormant) list.
    cache = cache ?? { generatedAt: Date.now(), assets: [] };
  }
  return Response.json(cache);
}
