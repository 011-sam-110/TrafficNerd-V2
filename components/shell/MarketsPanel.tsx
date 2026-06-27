"use client";
// Markets — a calm right-side slide-in showing live crypto prices. Opt-in (opened
// from the layer rail or ⌘K), so it never clutters the globe. Reuses the dossier /
// coverage idioms: a small external open store, /api/markets behind a ≥60s server
// cache, and the .tn-* light tokens. Honest by construction: it is labelled
// "Crypto markets · CoinGecko" and shows when the snapshot was last refreshed.
// Up = calm green, down = calm red (no neon). Only real keyless crypto is shown —
// no fabricated stock indices or commodities.

import { useEffect, useState } from "react";
import { marketsStore, useMarketsOpen } from "@/lib/shell/markets";
import { formatPrice, type MarketsPayload } from "@/lib/markets";
import { useNow, formatAge } from "@/lib/shell/useNow";

const REFRESH_MS = 60_000;

export default function MarketsPanel() {
  const open = useMarketsOpen();
  const [data, setData] = useState<MarketsPayload | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const now = useNow(1000);

  // Fetch on open, then poll on the cache cadence while open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = () => {
      setStatus((s) => (data ? s : "loading"));
      fetch("/api/markets")
        .then((r) => r.json())
        .then((d: MarketsPayload) => {
          if (!alive) return;
          setData(d);
          setStatus("idle");
        })
        .catch(() => {
          if (!alive) return;
          setStatus("error");
        });
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") marketsStore.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const ageMs = data ? Math.max(0, now - data.generatedAt) : null;

  return (
    <aside className="tn-markets" role="dialog" aria-label="Crypto markets">
      <header className="tn-markets-head">
        <div>
          <h2 className="tn-markets-title">Markets</h2>
          <p className="tn-markets-sub">Crypto markets · CoinGecko</p>
        </div>
        <button
          type="button"
          className="tn-markets-close"
          onClick={() => marketsStore.close()}
          aria-label="Close markets"
        >
          ×
        </button>
      </header>

      {status === "error" && !data && (
        <p className="tn-markets-status">Market data is unavailable right now.</p>
      )}
      {status === "loading" && !data && <p className="tn-markets-status">Loading prices…</p>}

      {data && data.assets.length > 0 && (
        <ul className="tn-markets-list">
          {data.assets.map((a) => {
            const up = a.changePct24h != null && a.changePct24h >= 0;
            const dir = a.changePct24h == null ? "flat" : up ? "up" : "down";
            return (
              <li key={a.id} className="tn-markets-row">
                <span className="tn-markets-asset">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="tn-markets-icon" src={a.image} alt="" width={18} height={18} />
                  ) : (
                    <span className="tn-markets-icon tn-markets-icon-fallback" aria-hidden />
                  )}
                  <span className="tn-markets-name">{a.name}</span>
                  <span className="tn-markets-symbol">{a.symbol}</span>
                </span>
                <span className="tn-markets-price tn-num">{formatPrice(a.price)}</span>
                <span className={`tn-markets-change tn-markets-${dir} tn-num`}>
                  {a.changePct24h == null
                    ? "—"
                    : `${up ? "▲" : "▼"} ${Math.abs(a.changePct24h).toFixed(2)}%`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.assets.length === 0 && status !== "loading" && (
        <p className="tn-markets-status">No market data available.</p>
      )}

      <p className="tn-markets-foot">
        {ageMs != null
          ? `Snapshot updated ${formatAge(ageMs)} ago · refreshes each minute.`
          : "Live keyless data — no account, no key."}{" "}
        Prices are indicative, not financial advice.
      </p>
    </aside>
  );
}
