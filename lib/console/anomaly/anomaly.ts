// Cross-layer "what's abnormal right now" ranking — the anomaly-first spine. Reads
// the live features across several signal layers and surfaces only the genuinely
// NOTABLE ones (severity above a floor), ranked by a composite of real-metric
// severity + recency. Pure + node-testable: the widget supplies the live features,
// this decides what rises to the top. No fabrication — severity comes from each
// source's declared metric (else the shared magnitude proxy), never invented.

import type { SignalFeature, SignalMetric } from "@/lib/signals/types";
import { rowMetric } from "@/lib/console/signals/signalCard";

export interface AnomalyInput {
  id: string;
  label: string;
  color: string;
  metric?: SignalMetric;
  features: SignalFeature[];
}

export interface AnomalyRow {
  id: string;
  title: string;
  layerId: string;
  layerLabel: string;
  /** 0..1 metric-normalised severity. */
  severity: number;
  /** 0..1 composite of severity + recency (the ranking key). */
  score: number;
  /** Human value label, e.g. "M6.2" / "Kp 6" / "82%"; "" when the layer has no metric. */
  valueLabel: string;
  color: string;
  ts: string;
  ageMs: number | null;
  lat: number;
  lon: number;
  feature: SignalFeature;
}

const HOUR = 3_600_000;

/** 0..1 severity for a feature under a layer's metric, else the 0–10 magnitude proxy. */
export function featureSeverity(f: SignalFeature, metric?: SignalMetric): { sev: number; label: string } {
  if (metric) {
    const m = rowMetric(f, metric);
    if (m) {
      const bot = metric.domain[0];
      const span = (metric.domain[1] - bot) || 1;
      return { sev: Math.max(0, Math.min(1, (m.value - bot) / span)), label: m.label };
    }
  }
  const mag = Number(f.props?.magnitude);
  if (Number.isFinite(mag) && mag > 0) return { sev: Math.max(0, Math.min(1, mag / 10)), label: "" };
  return { sev: 0, label: "" };
}

/** Recency weight from an ISO ts: fresh → 1, decaying with age, undated → 0.4. */
export function recencyWeight(ts: string | undefined, now: number): { w: number; ageMs: number | null } {
  if (!ts) return { w: 0.4, ageMs: null };
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return { w: 0.4, ageMs: null };
  const age = Math.max(0, now - t);
  if (age < HOUR) return { w: 1, ageMs: age };
  if (age < 6 * HOUR) return { w: 0.8, ageMs: age };
  if (age < 24 * HOUR) return { w: 0.6, ageMs: age };
  if (age < 3 * 24 * HOUR) return { w: 0.45, ageMs: age };
  return { w: 0.3, ageMs: age };
}

export interface RankOpts {
  /** Severity floor below which an item is "routine", not an anomaly (default 0.45). */
  minSeverity?: number;
  /** Max rows returned (default 15). */
  cap?: number;
}

/** Rank the most ABNORMAL items across layers; only items above minSeverity surface. */
export function rankAnomalies(inputs: AnomalyInput[], now: number, opts: RankOpts = {}): AnomalyRow[] {
  const minSev = opts.minSeverity ?? 0.45;
  const cap = opts.cap ?? 15;
  const rows: AnomalyRow[] = [];
  for (const inp of inputs) {
    for (const f of inp.features) {
      const { sev, label } = featureSeverity(f, inp.metric);
      if (sev < minSev) continue; // routine — filtered out of the anomaly feed
      const { w, ageMs } = recencyWeight(f.ts, now);
      rows.push({
        id: f.id,
        title: f.title,
        layerId: inp.id,
        layerLabel: inp.label,
        severity: sev,
        score: sev * 0.7 + w * 0.3,
        valueLabel: label,
        color: f.color ?? inp.color,
        ts: f.ts ?? "",
        ageMs,
        lat: f.lat,
        lon: f.lon,
        feature: f,
      });
    }
  }
  rows.sort((a, b) => b.score - a.score || (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return rows.slice(0, cap);
}
