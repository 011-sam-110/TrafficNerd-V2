import {
  parseMarkets,
  cryptoRows,
  parseFx,
  parseEquities,
  parseMacro,
  parseYahooChart,
  type CoinGeckoMarket,
  type MarketsPayload,
  type MarketSection,
  type YahooChart,
} from "@/lib/markets";

export const dynamic = "force-dynamic";

// GET /api/markets — a calm, multi-section markets snapshot. Two sections are
// always live and keyless (crypto · CoinGecko, FX · Frankfurter/ECB); two are
// key-gated and render DORMANT until configured (equities · Finnhub, macro · FRED).
// A ≥60s server cache shields the upstreams. Dormant-safe throughout: any failure
// serves the last good snapshot or an empty section — never a 5xx, never fabricated.

const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";
const CACHE_TTL_MS = 60_000;

const CG_ENDPOINT =
  "https://api.coingecko.com/api/v3/coins/markets" +
  "?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,cardano,dogecoin,binancecoin,tron" +
  "&order=market_cap_desc&price_change_percentage=24h";
const FX_ENDPOINT = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,CNY,CHF,CAD,AUD,INR";

const EQUITIES = [
  { symbol: "SPY", name: "S&P 500 (SPY)" },
  { symbol: "QQQ", name: "Nasdaq 100 (QQQ)" },
  { symbol: "DIA", name: "Dow 30 (DIA)" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "Nvidia" },
];
const FRED_SERIES = [
  { id: "DGS10", label: "10-Yr Treasury", unit: "%" },
  { id: "DFF", label: "Fed Funds Rate", unit: "%" },
  { id: "UNRATE", label: "US Unemployment", unit: "%" },
  { id: "VIXCLS", label: "VIX (volatility)", unit: "" },
];

// Keyless Yahoo v8 chart instruments. Commodities are always live; equities use
// Yahoo only when Finnhub isn't keyed (so the hosted site still shows stocks).
const COMMODITIES: { y: string; symbol: string; name: string }[] = [
  { y: "BZ=F", symbol: "Brent", name: "Brent Crude" },
  { y: "CL=F", symbol: "WTI", name: "Crude Oil (WTI)" },
  { y: "NG=F", symbol: "NatGas", name: "Natural Gas" },
  { y: "GC=F", symbol: "Gold", name: "Gold" },
  { y: "SI=F", symbol: "Silver", name: "Silver" },
  { y: "ZW=F", symbol: "Wheat", name: "Wheat" },
];
const YAHOO_EQUITIES: { y: string; symbol: string; name: string }[] = [
  { y: "SPY", symbol: "SPY", name: "S&P 500 (SPY)" },
  { y: "QQQ", symbol: "QQQ", name: "Nasdaq 100 (QQQ)" },
  { y: "DIA", symbol: "DIA", name: "Dow 30 (DIA)" },
  { y: "AAPL", symbol: "AAPL", name: "Apple" },
  { y: "MSFT", symbol: "MSFT", name: "Microsoft" },
  { y: "NVDA", symbol: "NVDA", name: "Nvidia" },
];
const yahooUrl = (sym: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;

let cache: MarketsPayload | null = null;

async function getJson<T>(url: string, ms = 12_000): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Fetch each Yahoo symbol in parallel and keep the rows that resolve. */
async function yahooRows(specs: { y: string; symbol: string; name: string }[]): Promise<MarketSection["rows"]> {
  const rows = await Promise.all(specs.map(async (spec) => parseYahooChart(await getJson<YahooChart>(yahooUrl(spec.y)), spec)));
  return rows.filter((r): r is NonNullable<typeof r> => r != null);
}

async function commoditiesSection(): Promise<MarketSection> {
  return { key: "commodities", label: "Commodities", source: "Yahoo Finance · delayed, keyless", rows: await yahooRows(COMMODITIES) };
}

async function cryptoSection(): Promise<MarketSection> {
  const rows = await getJson<CoinGeckoMarket[]>(CG_ENDPOINT);
  return { key: "crypto", label: "Crypto", source: "CoinGecko · keyless", rows: cryptoRows(parseMarkets(rows)) };
}

async function fxSection(): Promise<MarketSection> {
  const json = await getJson<{ base?: string; date?: string; rates?: Record<string, number> }>(FX_ENDPOINT);
  return { key: "fx", label: "Currencies", source: "Frankfurter / ECB · keyless", rows: parseFx(json) };
}

async function equitiesSection(): Promise<MarketSection> {
  const key = (process.env.FINNHUB_API_KEY ?? "").trim();
  if (!key) {
    // Keyless fallback: Yahoo delayed quotes so the hosted site still shows
    // equities without a Finnhub key. Finnhub (real-time) is used when keyed.
    return { key: "equities", label: "Equities", source: "Yahoo Finance · delayed, keyless", rows: await yahooRows(YAHOO_EQUITIES) };
  }
  const quotes = await Promise.all(
    EQUITIES.map(async (e) => {
      const q = await getJson<{ c?: number; dp?: number }>(`https://finnhub.io/api/v1/quote?symbol=${e.symbol}&token=${encodeURIComponent(key)}`);
      return { symbol: e.symbol, name: e.name, c: q?.c, dp: q?.dp };
    }),
  );
  return { key: "equities", label: "Equities", source: "Finnhub", rows: parseEquities(quotes) };
}

async function macroSection(): Promise<MarketSection> {
  const key = (process.env.FRED_API_KEY ?? "").trim();
  if (!key) {
    return { key: "macro", label: "Macro / rates", source: "FRED (St. Louis Fed)", dormant: true, note: "Set FRED_API_KEY to enable.", rows: [] };
  }
  const series = await Promise.all(
    FRED_SERIES.map(async (s) => {
      const json = await getJson<{ observations?: { date?: string; value?: string }[] }>(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=1`,
      );
      const obs = json?.observations?.[0];
      const value = obs?.value && obs.value !== "." ? Number(obs.value) : null;
      return { id: s.id, label: s.label, unit: s.unit, value, date: obs?.date };
    }),
  );
  return { key: "macro", label: "Macro / rates", source: "FRED (St. Louis Fed)", rows: parseMacro(series) };
}

export async function GET() {
  if (cache && Date.now() - cache.generatedAt < CACHE_TTL_MS) {
    return Response.json(cache);
  }
  try {
    const sections = await Promise.all([cryptoSection(), commoditiesSection(), fxSection(), equitiesSection(), macroSection()]);
    cache = { generatedAt: Date.now(), sections };
  } catch {
    cache = cache ?? { generatedAt: Date.now(), sections: [] };
  }
  return Response.json(cache);
}
