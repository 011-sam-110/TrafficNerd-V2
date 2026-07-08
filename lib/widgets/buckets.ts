// lib/widgets/buckets.ts
// Pure bucketing helpers for the detail-view distribution/timeline charts.

export function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) { const k = key(it); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

/** edges ascending, length n+1 → n bins. Value v lands in bin i when
 *  edges[i] <= v < edges[i+1]; the LAST bin is inclusive of the top edge. */
export function histogram(values: number[], edges: number[]): number[] {
  const n = Math.max(0, edges.length - 1);
  const bins = new Array<number>(n).fill(0);
  for (const v of values) {
    for (let i = 0; i < n; i++) {
      const lo = edges[i], hi = edges[i + 1];
      const inside = i === n - 1 ? v >= lo && v <= hi : v >= lo && v < hi;
      if (inside) { bins[i]++; break; }
    }
  }
  return bins;
}

export interface TimeBin { start: number; count: number }

/** n = ceil(spanMs/binMs) contiguous bins ending at `now`. Timestamps outside
 *  [now-n*binMs, now] are ignored. */
export function timeBins(tsList: number[], binMs: number, now: number, spanMs: number): TimeBin[] {
  const n = Math.max(1, Math.ceil(spanMs / binMs));
  const start0 = now - n * binMs;
  const bins: TimeBin[] = Array.from({ length: n }, (_, i) => ({ start: start0 + i * binMs, count: 0 }));
  for (const ts of tsList) {
    if (ts < start0 || ts > now) continue;
    const idx = Math.min(n - 1, Math.floor((ts - start0) / binMs));
    bins[idx].count++;
  }
  return bins;
}
