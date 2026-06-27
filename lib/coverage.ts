// Pure per-source camera coverage rollup — the honest "what is actually covered"
// view (M6, the trust theme). Groups the camera registry by source into
// { source, total, online } so the Coverage panel can state each region's live
// count factually, instead of one inflated "20k cameras" headline. The project's
// count-honesty principle: never a single big number, always per-region + freshness.
//
// Pure + isomorphic (no DOM, no network) so the grouping is unit-tested in node.

export interface CameraLike {
  source: string;
  available: boolean;
}

export interface SourceCoverage {
  source: string;
  total: number;
  online: number;
}

export interface Coverage {
  total: number;
  online: number;
  sources: SourceCoverage[];
}

/**
 * Group cameras by source, counting total + currently-online, sorted by total
 * descending (then source id, so ties are stable/deterministic).
 */
export function groupCoverage(cameras: CameraLike[]): Coverage {
  const bySource = new Map<string, SourceCoverage>();
  let total = 0;
  let online = 0;
  for (const c of cameras) {
    total++;
    if (c.available) online++;
    let rec = bySource.get(c.source);
    if (!rec) {
      rec = { source: c.source, total: 0, online: 0 };
      bySource.set(c.source, rec);
    }
    rec.total++;
    if (c.available) rec.online++;
  }
  const sources = [...bySource.values()].sort(
    (a, b) => b.total - a.total || a.source.localeCompare(b.source),
  );
  return { total, online, sources };
}
