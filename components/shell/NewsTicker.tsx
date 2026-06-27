"use client";
// A thin, calm world-headlines strip that sits just above the freshness ticker.
// Dormant-safe: empty feed → nothing rendered. Visibility is variant-driven via
// PanelHost (Task 9) which only mounts this component when the active variant
// includes the `news` panel.

import { useEffect, useState } from "react";
import type { NewsItem, NewsPayload } from "@/lib/news";

const REFRESH_MS = 5 * 60 * 1000;

export default function NewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
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
  }, []);

  if (items.length === 0) return null;

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
    </div>
  );
}
