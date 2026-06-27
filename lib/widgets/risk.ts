// Pure: a transparent global risk index from the CII — the mean of the top-N
// country scores. No fabricated trend (we don't store history yet) → the widget
// shows "—" for trend. `count` is how many countries are above the CII floor.

import type { SignalFeature } from "@/lib/signals/types";

export type RiskLevel = "Low" | "Elevated" | "High" | "Severe";

export interface RiskSummary {
  score: number;
  level: RiskLevel;
  count: number;
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 70) return "Severe";
  if (score >= 50) return "High";
  if (score >= 30) return "Elevated";
  return "Low";
}

export function riskSummary(features: SignalFeature[], topN = 10): RiskSummary {
  const scores = features
    .map((f) => Number(f.props?.score ?? 0))
    .filter((n) => n > 0)
    .sort((a, b) => b - a)
    .slice(0, topN);
  const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { score, level: riskLevel(score), count: features.length };
}
