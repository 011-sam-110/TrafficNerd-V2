// One freshness vocabulary across the two different per-source freshness systems:
// core layers (lib/freshness.ts → FreshState) and signals (lib/signals/freshness.ts
// → SignalFreshState, which adds the honest "empty" = connected-but-zero state).
// `off` is added for a placed widget whose source is not currently being fetched
// (Phase 1: no widget-driven fetch yet). Pure + node-testable.

import type { FreshState } from "@/lib/freshness";
import type { SignalFreshState } from "@/lib/signals/freshness";

export type FreshKind = "off" | "unknown" | "live" | "empty" | "lagging" | "stale" | "down";

export function unifyCoreFresh(s: FreshState): FreshKind {
  return s; // FreshState ⊂ FreshKind
}

export function unifySignalFresh(s: SignalFreshState): FreshKind {
  return s; // SignalFreshState ⊂ FreshKind
}

// Higher = worse. Healthy (live/empty) lowest; broken (down) highest. `off`/`unknown`
// sit mid: not an error, but not delivering data either.
const RANK: Record<FreshKind, number> = {
  live: 0,
  empty: 0,
  lagging: 1,
  off: 2,
  unknown: 2,
  stale: 3,
  down: 4,
};

export function freshRank(k: FreshKind): number {
  return RANK[k];
}

export function worseFresh(a: FreshKind, b: FreshKind): FreshKind {
  return RANK[b] > RANK[a] ? b : a;
}
