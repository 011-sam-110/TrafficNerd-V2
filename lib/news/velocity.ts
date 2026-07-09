// lib/news/velocity.ts
// Coverage velocity: how fast is a story being picked up? Counts the DISTINCT
// sources that published into a cluster inside a recent window (default 10m).
// PURE + node-testable. Honest: with no parseable timestamps we return null
// (no fabricated momentum), and the UI simply omits the indicator.

import type { Cluster } from "./cluster";

export interface Velocity {
  /** Distinct sources with an item inside the window. */
  recentSources: number;
  /** Distinct sources across the whole cluster. */
  totalSources: number;
  windowMin: number;
  /** ≥2 distinct sources within the window = a genuine corroboration surge. */
  trending: boolean;
}

/** Pure: cluster → velocity, or null when the cluster has no usable timestamps. */
export function clusterVelocity(cluster: Cluster, now: number, windowMs = 10 * 60_000): Velocity | null {
  const withTs = cluster.items.filter((i) => i.ts > 0);
  if (withTs.length === 0) return null;
  const recent = new Set<string>();
  for (const it of withTs) {
    const age = now - it.ts;
    if (age >= 0 && age <= windowMs) recent.add(it.source);
  }
  return {
    recentSources: recent.size,
    totalSources: cluster.sourceCount,
    windowMin: Math.round(windowMs / 60000),
    trending: recent.size >= 2,
  };
}

/** Short "+N sources in Xm" label, or null when there's nothing recent to show. */
export function velocityLabel(v: Velocity | null): string | null {
  if (!v || v.recentSources <= 0) return null;
  return `+${v.recentSources} source${v.recentSources === 1 ? "" : "s"} in ${v.windowMin}m`;
}
