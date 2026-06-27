"use client";
// Strategic Risk widget — a transparent global risk index: the mean of the most-
// pressured countries' CII scores, shown as a calm gauge with an honest level. No
// fabricated trend (we don't store history yet). Dock-only (v1).

import { useSignalFeatures } from "@/lib/widgets/useSignalFeatures";
import { riskSummary } from "@/lib/widgets/risk";

export default function RiskPanel({ docked = false }: { docked?: boolean } = {}) {
  const { features, status } = useSignalFeatures("instability", docked);
  if (!docked) return null;

  const r = riskSummary(features);
  const empty = status !== "loading" && features.length === 0;
  return (
    <aside className="tn-widget tn-docked tn-widget-risk" role="region" aria-label="Strategic risk">
      <header className="tn-widget-head">
        <h2 className="tn-widget-title">Strategic Risk</h2>
        <span className="tn-widget-source">global CII index</span>
      </header>
      {empty ? (
        <p className="tn-widget-status">No data right now.</p>
      ) : (
        <div className="tn-risk-gauge" data-level={r.level.toLowerCase()}>
          <span className="tn-risk-score tn-num">{r.score}</span>
          <span className="tn-risk-level">{r.level}</span>
        </div>
      )}
      <p className="tn-widget-foot">
        Mean of the {Math.min(10, r.count)} most-pressured countries · {r.count} flagged · trend —
      </p>
    </aside>
  );
}
