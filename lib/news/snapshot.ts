// lib/news/snapshot.ts
// Updated / correction tracking. We keep a small last-seen snapshot (url → title)
// in localStorage; on each load we diff the current feed against it to flag
// headlines whose wording changed since we last saw them (a common signal of a
// live-updated or corrected story). PURE diff here + node-testable; the
// persistence wrapper (below) is SSR-safe and only runs in the browser.

import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export type Snapshot = Record<string, string>; // url -> last-seen title

export interface Change {
  url: string;
  from: string;
  to: string;
}

/** Pure: current items → a fresh snapshot (last title wins per url). */
export function snapshotOf(items: { url: string; title: string }[]): Snapshot {
  const s: Snapshot = {};
  for (const it of items) if (it.url) s[it.url] = it.title;
  return s;
}

/** Pure: titles that changed vs the previous snapshot (empty when no prior snapshot). */
export function diffSnapshots(prev: Snapshot | null, items: { url: string; title: string }[]): Change[] {
  if (!prev) return [];
  const out: Change[] = [];
  for (const it of items) {
    if (!it.url) continue;
    const before = prev[it.url];
    if (before != null && before !== it.title) out.push({ url: it.url, from: before, to: it.title });
  }
  return out;
}

const KEY = "tn.news.snapshot.v1";
const VERSION = 1;

/** Browser: load the previous snapshot (null on miss / SSR). */
export function loadSnapshot(): Snapshot | null {
  return loadPersisted<Snapshot>(KEY, VERSION);
}

/** Browser: persist the current snapshot (bounded — one entry per current url). */
export function saveSnapshot(items: { url: string; title: string }[]): void {
  savePersisted(KEY, VERSION, snapshotOf(items));
}
