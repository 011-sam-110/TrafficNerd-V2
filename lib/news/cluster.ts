// lib/news/cluster.ts
// Story clustering: group headlines that describe the SAME event into one parent
// "mega-card" carrying every source that reported it. PURE + node-testable.
//
// Method: normalise each title (drop the publisher suffix + punctuation), reduce
// it to a set of significant tokens (stop-words removed), then greedily assign
// each headline (newest-first) to the existing cluster whose LEAD headline it most
// overlaps with — measured by Jaccard similarity, and only when they share at
// least two significant tokens (so a single common word like "Iran" never fuses
// two unrelated stories). No shared token → its own new cluster.

import type { NewsItem } from "@/lib/news";

// Function words + newsroom filler that carry no event identity.
const STOP = new Set(
  ("a an the of to in on at for and or but with from by as is are was were be been being this that " +
    "these those over under after before amid into out up down not no more most least new latest " +
    "breaking live update updates report reports says say said will would could can may might has have " +
    "had its it he she they them his her their you we our us who what when where why how than then " +
    "about across against among around between during through per via amid off onto upon")
    .split(/\s+/),
);

// Publisher suffixes RSS titles sometimes append, e.g. " - BBC News", " | Reuters".
const SUFFIX_RE =
  /\s*[-|–—:]\s*(bbc(?:\s?news)?|al\s?jazeera|npr|the\s?guardian|guardian|dw|deutsche\s?welle|france\s?24|reuters|associated\s?press|ap|cnn|sky\s?news)\s*$/i;

/** Pure: title → lower-cased, de-suffixed, punctuation-stripped canonical form. */
export function normalizeTitle(title: string): string {
  return (title ?? "")
    .replace(SUFFIX_RE, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pure: title → set of significant tokens (≥3 chars, stop-words removed). */
export function titleTokens(title: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalizeTitle(title).split(" ")) {
    if (w.length >= 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

/**
 * Similarity between two token sets:
 *  - `score`  = Jaccard (shared / union)
 *  - `shared` = raw shared-token count
 *  - `coeff`  = overlap coefficient (shared / min-size) — forgiving when two
 *               outlets word the same event at very different lengths.
 */
export function overlap(a: Set<string>, b: Set<string>): { score: number; shared: number; coeff: number } {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: 0, coeff: 0 };
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const union = a.size + b.size - shared;
  const minSize = Math.min(a.size, b.size);
  return { score: union === 0 ? 0 : shared / union, shared, coeff: minSize === 0 ? 0 : shared / minSize };
}

export interface Cluster {
  /** Stable-ish id — the lead (newest) headline's URL. */
  id: string;
  /** Lead (newest) headline's title, used as the card headline. */
  title: string;
  lead: NewsItem;
  /** Every member, newest-first (includes the lead). */
  items: NewsItem[];
  /** Distinct source display names, first-seen order. */
  sources: string[];
  sourceCount: number;
  latestTs: number;
  earliestTs: number;
}

export interface ClusterOptions {
  /** Minimum Jaccard to fuse (default 0.26). */
  threshold?: number;
  /** Minimum shared significant tokens to fuse (default 2). */
  minShared?: number;
}

/**
 * Fuse when the headlines clearly describe the same event. Two signals, either
 * sufficient (both gated by ≥minShared shared tokens so one common word never
 * fuses unrelated stories):
 *   • Jaccard ≥ threshold — similar wording overall, OR
 *   • overlap-coefficient ≥ 0.6 with ≥3 shared tokens — same core entities even
 *     when one outlet's headline is much longer/differently phrased.
 */
function shouldMerge(o: { score: number; shared: number; coeff: number }, threshold: number, minShared: number): boolean {
  if (o.shared < minShared) return false;
  return o.score >= threshold || (o.coeff >= 0.6 && o.shared >= 3);
}

interface Work {
  items: NewsItem[];
  toks: Set<string>; // the LEAD headline's tokens (fixed — keeps clusters tight)
}

function finalize(w: Work): Cluster {
  const items = [...w.items].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const lead = items[0];
  const sources: string[] = [];
  for (const it of items) if (!sources.includes(it.source)) sources.push(it.source);
  const tss = items.map((i) => i.ts || 0).filter((n) => n > 0);
  return {
    id: lead.url,
    title: lead.title,
    lead,
    items,
    sources,
    sourceCount: sources.length,
    latestTs: tss.length ? Math.max(...tss) : 0,
    earliestTs: tss.length ? Math.min(...tss) : 0,
  };
}

/**
 * Pure: headlines → event clusters, newest-first (ties broken by source count).
 * Deterministic for a given input ordering.
 */
export function clusterNews(items: NewsItem[], opts: ClusterOptions = {}): Cluster[] {
  const threshold = opts.threshold ?? 0.26;
  const minShared = opts.minShared ?? 2;
  const sorted = [...items].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const work: Work[] = [];
  for (const it of sorted) {
    const toks = titleTokens(it.title);
    let best: Work | null = null;
    let bestScore = 0;
    for (const w of work) {
      const o = overlap(toks, w.toks);
      if (shouldMerge(o, threshold, minShared) && o.score > bestScore) {
        bestScore = o.score;
        best = w;
      }
    }
    if (best) best.items.push(it);
    else work.push({ items: [it], toks });
  }
  return work.map(finalize).sort((a, b) => b.latestTs - a.latestTs || b.sourceCount - a.sourceCount);
}
