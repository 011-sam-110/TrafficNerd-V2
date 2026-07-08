"use client";
// World Headlines widget — the RSS news data piece as a monitor card. Reads the
// keyless /api/news payload (BBC / Al Jazeera / NPR / Guardian world feeds) and
// lists the latest headlines with source + relative time, each linking out.

import { useEffect } from "react";
import { registerWidget } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import type { NewsItem } from "@/lib/news";
import { useJsonPoll } from "@/lib/console/widgets/useJsonPoll";
import HeadlinesDetail from "@/lib/console/widgets/headlines.detail";

interface NewsPayload {
  generatedAt: number;
  items: NewsItem[];
}
const EMPTY: NewsPayload = { generatedAt: 0, items: [] };

function rel(ts: number, now: number): string {
  if (!ts) return "";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function HeadlinesBody() {
  const { data, status } = useJsonPoll<NewsPayload>("/api/news", 120_000, EMPTY);
  const items = data.items ?? [];

  const report = useWidgetReport();
  useEffect(() => {
    report({ alerts: [], count: items.length, freshLabel: "live" });
  }, [items.length, report]);

  if (status === "loading" && items.length === 0) return <p className="tn-w-empty">Loading headlines…</p>;
  if (items.length === 0) return <p className="tn-w-empty">No headlines.</p>;

  const now = Date.now();
  return (
    <ul className="tn-w-list">
      {items.slice(0, 60).map((it, i) => {
        const r = rel(it.ts, now);
        return (
          <li key={it.url || i}>
            <a
              href={it.url}
              target="_blank"
              rel="noreferrer"
              className="tn-w-place"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {it.title}
            </a>
            <span className="tn-w-muted">
              {" "}· {it.source}
              {r ? ` · ${r}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const HEADLINES_WIDGET = {
  id: "headlines",
  title: "World Headlines",
  icon: "📰",
  category: "News",
  defaultHeight: 300,
  defaultConfig: {},
  component: HeadlinesBody,
  detail: HeadlinesDetail,
};
registerWidget(HEADLINES_WIDGET);
