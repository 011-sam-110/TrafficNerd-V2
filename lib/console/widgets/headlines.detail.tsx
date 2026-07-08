// lib/console/widgets/headlines.detail.tsx
"use client";
// Headlines focus view — a newsroom board. Reuses the SAME /api/news poll as the
// docked widget, rendering deep: source filter + search, a recency-grouped feed with
// snippets, an hourly volume strip (Task 6), on-demand AI summaries (Task 7), and a
// sources footer + export (Task 8).
import { useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import type { NewsItem } from "@/lib/news";
import { useJsonPoll } from "@/lib/console/widgets/useJsonPoll";
import { countBy } from "@/lib/widgets/buckets";

interface NewsPayload { generatedAt: number; items: NewsItem[] }
const EMPTY: NewsPayload = { generatedAt: 0, items: [] };
const SOURCES = ["BBC", "Al Jazeera", "NPR", "The Guardian"];

function rel(ts: number, now: number): string {
  if (!ts) return "";
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}
function bucketOf(ts: number, now: number): "Last hour" | "Today" | "Earlier" {
  const h = (now - ts) / 3_600_000;
  if (ts && h < 1) return "Last hour";
  if (ts && h < 24) return "Today";
  return "Earlier";
}
const BUCKET_ORDER = ["Last hour", "Today", "Earlier"] as const;

export default function HeadlinesDetail({ }: WidgetDetailProps) {
  const { data, status } = useJsonPoll<NewsPayload>("/api/news", 120_000, EMPTY);
  const items = useMemo(() => data.items ?? [], [data.items]);
  const [srcFilter, setSrcFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const now = Date.now();

  const counts = useMemo(() => countBy(items, (it) => it.source), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (it) =>
        (srcFilter == null || it.source === srcFilter) &&
        (!q || it.title.toLowerCase().includes(q) || (it.description ?? "").toLowerCase().includes(q)),
    );
  }, [items, srcFilter, query]);

  const groups = useMemo(() => {
    const by = new Map<string, NewsItem[]>();
    for (const it of filtered) {
      const b = bucketOf(it.ts, now);
      const g = by.get(b) ?? [];
      g.push(it);
      by.set(b, g);
    }
    return BUCKET_ORDER.filter((b) => by.has(b)).map((b) => [b, by.get(b)!] as const);
  }, [filtered, now]);

  return (
    <div className="tn-hd">
      <div className="tn-hd-bar">
        <div className="tn-hd-chips">
          <button className={srcFilter == null ? "is-on" : ""} onClick={() => setSrcFilter(null)}>All {items.length}</button>
          {SOURCES.map((s) => (
            <button key={s} className={srcFilter === s ? "is-on" : ""} onClick={() => setSrcFilter(s)}>{s} {counts[s] ?? 0}</button>
          ))}
        </div>
        <input className="tn-hd-search" placeholder="Search headlines…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {status === "loading" && items.length === 0 && <p className="tn-w-empty">Loading headlines…</p>}
      {items.length > 0 && filtered.length === 0 && <p className="tn-w-empty">No headlines match.</p>}

      {groups.map(([bucket, rows]) => (
        <section key={bucket} className="tn-hd-group">
          <h3 className="tn-hd-group-h">{bucket} · {rows.length}</h3>
          <ul className="tn-hd-list">
            {rows.map((it, i) => (
              <li key={it.url || i} className="tn-hd-item">
                <a className="tn-hd-title" href={it.url} target="_blank" rel="noreferrer">{it.title}</a>
                <div className="tn-hd-meta"><span className="tn-hd-src">{it.source}</span>{it.ts ? ` · ${rel(it.ts, now)}` : ""}</div>
                {it.description && <p className="tn-hd-snippet">{it.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
