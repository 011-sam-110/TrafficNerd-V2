"use client";
// A thin, calm world-headlines strip that sits just above the freshness ticker.
// Dismissible (× / ⌘K toggle, persisted via uiStore) so it never nags. Headlines
// come from /api/news (merged keyless RSS, server-parsed) and each links to its
// source article. The scroll is gentle and pauses on hover; reduced-motion users
// get a static, scrollable list instead. Dormant-safe: empty feed → nothing.

import { useEffect, useState } from "react";
import { uiStore, useUI } from "@/lib/shell/ui";
import type { NewsItem, NewsPayload } from "@/lib/news";

const REFRESH_MS = 5 * 60 * 1000;

export default function NewsTicker() {
  const ui = useUI();
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    if (!ui.newsTicker) return;
    let alive = true;
    const load = () => {
      fetch("/api/news")
        .then((r) => r.json())
        .then((d: NewsPayload) => {
          if (alive) setItems(d.items ?? []);
        })
        .catch(() => {
          /* dormant-safe: keep whatever we have */
        });
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ui.newsTicker]);

  if (!ui.newsTicker || items.length === 0) return null;

  // Duplicate the run so the marquee wraps seamlessly.
  const run = [...items, ...items];

  return (
    <div className="tn-news" aria-label="World headlines">
      <span className="tn-news-label">LIVE</span>
      <div className="tn-news-viewport">
        <div className="tn-news-track">
          {run.map((it, i) => (
            <a
              key={`${it.url}-${i}`}
              className="tn-news-item"
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${it.title} — ${it.source}`}
            >
              <span className="tn-news-source">{it.source}</span>
              <span className="tn-news-title">{it.title}</span>
              <span className="tn-news-sep" aria-hidden>
                •
              </span>
            </a>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="tn-news-close"
        onClick={() => uiStore.setNewsTicker(false)}
        aria-label="Hide news ticker"
        title="Hide headlines (re-enable from ⌘K)"
      >
        ×
      </button>
    </div>
  );
}
