// Breaking-alert selection — the project's anti-"crying wolf" honesty rule. The
// banner ONLY surfaces a genuinely significant event derived from data we already
// fetch; if nothing qualifies it returns null and the banner renders nothing.
// Nothing here is fabricated. Pure + isomorphic → fully unit-tested.
//
// Two honest triggers, quake first:
//   1. A MAJOR earthquake — a USGS signal feature with magnitude ≥ 6.0 in the
//      last few hours (reuses the existing earthquakes layer).
//   2. A CORROBORATED news cluster — a salient keyword shared across several
//      recent headlines from MULTIPLE distinct outlets (corroboration-lite:
//      one outlet alone never trips it).

import type { SignalFeature } from "@/lib/signals/types";
import type { NewsItem } from "@/lib/news";

export interface BreakingAlert {
  /** Stable key for persisted dismissal (so the same alert never nags twice). */
  key: string;
  kind: "quake" | "news";
  /** The headline sentence shown in the banner. */
  text: string;
  /** Secondary attribution / context line. */
  detail: string;
  /** What the "View" button does. */
  action:
    | { type: "fly"; lat: number; lon: number }
    | { type: "open"; url: string };
}

const QUAKE_MIN_MAG = 6.0;
const QUAKE_RECENT_MS = 6 * 60 * 60 * 1000; // last 6h
const NEWS_MIN_HEADLINES = 3; // token must appear in ≥3 headlines
const NEWS_MIN_SOURCES = 2; // …from ≥2 distinct outlets (corroboration)

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "after", "over", "into", "amid", "says",
  "say", "new", "out", "off", "but", "not", "has", "have", "are", "was", "were",
  "will", "its", "their", "this", "that", "than", "then", "who", "what", "how",
  "why", "when", "where", "more", "most", "some", "all", "you", "your", "his",
  "her", "they", "them", "could", "would", "should", "about", "against", "as",
  "to", "of", "in", "on", "at", "by", "up", "a", "an", "is", "be", "it",
]);

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Pick the strongest recent major quake, if any. */
function selectQuake(quakes: SignalFeature[], now: number): BreakingAlert | null {
  let best: { f: SignalFeature; mag: number } | null = null;
  for (const f of quakes) {
    const mag = num(f.props?.magnitude);
    if (mag == null || mag < QUAKE_MIN_MAG) continue;
    const t = f.ts ? Date.parse(f.ts) : NaN;
    if (Number.isFinite(t) && now - t > QUAKE_RECENT_MS) continue;
    const tBest = best?.f.ts ? Date.parse(best.f.ts) : NaN;
    if (
      !best ||
      mag > best.mag ||
      (mag === best.mag && Number.isFinite(t) && (!Number.isFinite(tBest) || t > tBest))
    ) {
      best = { f, mag };
    }
  }
  if (!best) return null;
  const place = (best.f.props?.place as string | undefined) ?? best.f.title;
  return {
    key: `quake:${best.f.id}`,
    kind: "quake",
    text: `Major earthquake — magnitude ${best.mag.toFixed(1)}`,
    detail: `${place} · USGS`,
    action: { type: "fly", lat: best.f.lat, lon: best.f.lon },
  };
}

interface Cluster {
  token: string;
  headlines: number;
  sources: Set<string>;
  newest: NewsItem;
}

/** Pick a corroborated news cluster (≥N headlines across ≥M outlets), if any. */
function selectNewsCluster(news: NewsItem[], limit = 25): BreakingAlert | null {
  const recent = [...news].sort((a, b) => b.ts - a.ts).slice(0, limit);
  const clusters = new Map<string, Cluster>();
  for (const item of recent) {
    const tokens = new Set(
      item.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
    );
    for (const token of tokens) {
      let c = clusters.get(token);
      if (!c) {
        c = { token, headlines: 0, sources: new Set(), newest: item };
        clusters.set(token, c);
      }
      c.headlines++;
      c.sources.add(item.source);
      if (item.ts > c.newest.ts) c.newest = item;
    }
  }

  let best: Cluster | null = null;
  for (const c of clusters.values()) {
    if (c.headlines < NEWS_MIN_HEADLINES || c.sources.size < NEWS_MIN_SOURCES) continue;
    if (
      !best ||
      c.sources.size > best.sources.size ||
      (c.sources.size === best.sources.size && c.headlines > best.headlines)
    ) {
      best = c;
    }
  }
  if (!best) return null;
  return {
    key: `news:${best.token}`,
    kind: "news",
    text: best.newest.title,
    detail: `${best.sources.size} outlets covering this · ${best.newest.source}`,
    action: { type: "open", url: best.newest.url },
  };
}

/**
 * Pure: choose the single most significant honest alert, or null. A major recent
 * earthquake outranks a news cluster. Never fabricates — both branches require
 * real, corroborated input.
 */
export function selectBreakingAlert(
  quakes: SignalFeature[],
  news: NewsItem[],
  now: number = Date.now(),
): BreakingAlert | null {
  return selectQuake(quakes ?? [], now) ?? selectNewsCluster(news ?? []);
}
