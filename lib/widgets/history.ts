"use client";
// A tiny per-source count history so a monitor widget can show a ▴/▾ delta and a
// glance sparkline WITHOUT any new fetch — the live hook records the count it already
// reads from the existing stores. Pure ring-buffer maths (node-tested) + a thin
// module-singleton store (mirrors lib/metrics.ts).

import { useSyncExternalStore } from "react";

export interface CountSample {
  t: number; // epoch ms
  n: number; // count at t
}

const CAP = 24;

/** Pure: append a sample, collapsing a same-count tail (only advancing time), capped. */
export function pushSample(buf: CountSample[], s: CountSample, cap: number = CAP): CountSample[] {
  const last = buf[buf.length - 1];
  let next: CountSample[];
  if (last && last.n === s.n) {
    next = [...buf.slice(0, -1), { t: s.t, n: s.n }];
  } else {
    next = [...buf, s];
  }
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Pure: latest − previous; 0 when fewer than two samples. */
export function deltaOf(buf: CountSample[]): number {
  if (buf.length < 2) return 0;
  return buf[buf.length - 1].n - buf[buf.length - 2].n;
}

/** Pure: last `slots` counts normalized to 0..1 (flat 0.5 line when all equal). */
export function trendOf(buf: CountSample[], slots: number): number[] {
  const tail = buf.slice(-slots).map((x) => x.n);
  if (tail.length === 0) return [];
  const min = Math.min(...tail);
  const max = Math.max(...tail);
  if (max === min) return tail.map(() => 0.5);
  return tail.map((n) => (n - min) / (max - min));
}

// --- store ------------------------------------------------------------------
let hist: Record<string, CountSample[]> = {};
const listeners = new Set<() => void>();

export const countHistoryStore = {
  record(id: string, n: number, at: number = Date.now()) {
    const prev = hist[id] ?? [];
    const next = pushSample(prev, { t: at, n });
    if (next === prev) return;
    hist = { ...hist, [id]: next };
    for (const l of listeners) l();
  },
  get(): Record<string, CountSample[]> {
    return hist;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const EMPTY: CountSample[] = [];
export function useCountHistory(id: string): CountSample[] {
  const all = useSyncExternalStore(countHistoryStore.subscribe, countHistoryStore.get, countHistoryStore.get);
  return all[id] ?? EMPTY;
}
