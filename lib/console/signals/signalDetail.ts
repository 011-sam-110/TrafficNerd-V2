// Pure projection helpers for the Signals FOCUS detail view. The distribution
// logic is deliberately honest: it shows a magnitude histogram only when the
// source actually carries numeric magnitudes, falls back to declared severity
// counts, and reports "none" when neither exists (the caller then hides the panel).
import type { SignalFeature } from "@/lib/signals/types";
import { histogram } from "@/lib/widgets/buckets";

/** Declared severity read from common alert-level props — only unambiguous words. */
export function declaredSeverity(props?: Record<string, unknown>): "critical" | "warn" | null {
  if (!props) return null;
  for (const key of ["alertlevel", "alertLevel", "severity", "level", "status"]) {
    const v = props[key];
    if (typeof v !== "string") continue;
    const s = v.toLowerCase();
    if (/red|extreme|severe|critical|emergency/.test(s)) return "critical";
    if (/orange|warning|high|moderate/.test(s)) return "warn";
  }
  return null;
}

/** Finite numeric props.magnitude values. */
export function magnitudeValues(features: SignalFeature[]): number[] {
  const out: number[] = [];
  for (const f of features) {
    const m = f.props?.magnitude;
    if (typeof m === "number" && Number.isFinite(m)) out.push(m);
  }
  return out;
}

export interface Distribution {
  kind: "magnitude" | "severity" | "none";
  bins: { label: string; count: number }[];
}

/** Honest distribution: magnitude histogram → severity counts → none. */
export function distribution(features: SignalFeature[]): Distribution {
  const mags = magnitudeValues(features);
  if (mags.length > 0) {
    const lo = Math.floor(Math.min(...mags));
    const maxV = Math.max(...mags);
    // When the max is an exact integer, extend the top edge by one so it gets its
    // OWN bucket instead of merging into the penultimate one (off-by-one guard).
    const hi = Math.ceil(maxV) + (Number.isInteger(maxV) ? 1 : 0);
    const span = Math.max(1, hi - lo);
    const step = Math.max(1, Math.ceil(span / 8)); // ≤8 integer-width buckets
    const edges: number[] = [];
    for (let e = lo; e < hi; e += step) edges.push(e);
    edges.push(hi);
    // Reuse the node-tested histogram (last bin inclusive of the top edge).
    const bins = histogram(mags, edges).map((count, i) => ({
      label: step === 1 ? `${edges[i]}` : `${edges[i]}–${edges[i + 1]}`,
      count,
    }));
    return { kind: "magnitude", bins };
  }
  let critical = 0, warn = 0, other = 0;
  for (const f of features) {
    const s = declaredSeverity(f.props);
    if (s === "critical") critical++;
    else if (s === "warn") warn++;
    else other++;
  }
  if (critical > 0 || warn > 0) {
    return { kind: "severity", bins: [
      { label: "Severe", count: critical },
      { label: "Warning", count: warn },
      { label: "Other", count: other },
    ] };
  }
  return { kind: "none", bins: [] };
}

/** Parseable ISO timestamps → ms, plus the count of undated features. */
export function timeModel(features: SignalFeature[]): { values: number[]; undated: number } {
  const values: number[] = [];
  let undated = 0;
  for (const f of features) {
    const t = f.ts ? Date.parse(f.ts) : NaN;
    if (Number.isFinite(t)) values.push(t);
    else undated++;
  }
  return { values, undated };
}

export type SortKey = "magnitude" | "recency" | "title";

/** Stable-ish sort by magnitude / recency / title. Missing values sort last. */
export function sortFeatures(features: SignalFeature[], key: SortKey, dir: 1 | -1): SignalFeature[] {
  const mag = (f: SignalFeature) =>
    typeof f.props?.magnitude === "number" && Number.isFinite(f.props.magnitude) ? (f.props.magnitude as number) : -Infinity;
  const rec = (f: SignalFeature) => (f.ts ? Date.parse(f.ts) : NaN);
  const cmp = (a: SignalFeature, b: SignalFeature): number => {
    if (key === "title") return a.title.localeCompare(b.title);
    if (key === "magnitude") return mag(a) - mag(b);
    const ra = rec(a), rb = rec(b);
    return (Number.isFinite(ra) ? ra : -Infinity) - (Number.isFinite(rb) ? rb : -Infinity);
  };
  return [...features].sort((a, b) => dir * cmp(a, b));
}
