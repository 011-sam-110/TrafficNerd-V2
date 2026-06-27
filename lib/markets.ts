// Pure crypto-markets normaliser. CoinGecko's /coins/markets returns a verbose
// row per asset; we keep only the calm, honest subset the panel renders:
// name, symbol, price, 24h % change, market cap, an icon and the upstream
// last_updated stamp. Keyless. Pure + isomorphic so it unit-tests in node.
//
// Endpoint shape confirmed live 2026-06-27:
//   https://api.coingecko.com/api/v3/coins/markets
//     ?vs_currency=usd&ids=bitcoin,ethereum,…&price_change_percentage=24h
//   → array of { id, symbol, name, image, current_price,
//                price_change_percentage_24h, market_cap, last_updated, … }

export interface CoinGeckoMarket {
  id?: string;
  symbol?: string;
  name?: string;
  image?: string | null;
  current_price?: number | null;
  price_change_percentage_24h?: number | null;
  market_cap?: number | null;
  last_updated?: string | null;
}

export interface MarketAsset {
  id: string;
  symbol: string; // upper-cased ticker, e.g. "BTC"
  name: string;
  price: number; // USD
  changePct24h: number | null; // signed %, null when upstream omits it
  marketCap: number | null;
  image?: string;
  updatedAt?: string; // ISO from upstream
}

export interface MarketsPayload {
  generatedAt: number;
  assets: MarketAsset[];
}

/** Pure: CoinGecko rows → MarketAsset[]. Skips rows with no id or no price. */
export function parseMarkets(rows: CoinGeckoMarket[] | null | undefined): MarketAsset[] {
  if (!Array.isArray(rows)) return [];
  const out: MarketAsset[] = [];
  for (const r of rows) {
    const id = r.id?.toString().trim();
    // Number(null) is 0, so guard null/undefined explicitly before coercing.
    const price = r.current_price == null ? Number.NaN : Number(r.current_price);
    if (!id || !Number.isFinite(price)) continue;
    const changeRaw = r.price_change_percentage_24h;
    const change =
      typeof changeRaw === "number" && Number.isFinite(changeRaw) ? changeRaw : null;
    const cap = r.market_cap != null && Number.isFinite(Number(r.market_cap)) ? Number(r.market_cap) : null;
    out.push({
      id,
      symbol: (r.symbol ?? "").toString().toUpperCase() || id.toUpperCase(),
      name: r.name?.toString().trim() || id,
      price,
      changePct24h: change == null ? null : Number(change.toFixed(2)),
      marketCap: cap,
      image: r.image?.toString() || undefined,
      updatedAt: r.last_updated?.toString() || undefined,
    });
  }
  return out;
}

/** Compact USD price: "$60,155", "$1.06", "$0.0756". Calm, no neon. */
export function formatPrice(usd: number): string {
  const digits = usd >= 1 ? 2 : usd >= 0.01 ? 4 : 6;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
