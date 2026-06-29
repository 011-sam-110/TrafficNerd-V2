"use client";
// Markets widget — the financial data piece as a monitor card. Reads the keyless
// /api/markets payload (CoinGecko crypto + ECB FX live; keyed equities/macro stay
// dormant) and lists each section's rows, flagging big movers as alerts. Reuses
// the shared .tn-w-* row classes; the +/- colour is the only inline styling.

import { useEffect, useMemo } from "react";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import type { Alert, AlertSeverity } from "@/lib/console/alerts";
import type { MarketsPayload } from "@/lib/markets";
import { useJsonPoll } from "@/lib/console/widgets/useJsonPoll";

const EMPTY: MarketsPayload = { generatedAt: 0, sections: [] };
const RANK: Record<AlertSeverity, number> = { info: 0, warn: 1, critical: 2 };

function MarketsBody({ config }: WidgetBodyProps) {
  const { data, status } = useJsonPoll<MarketsPayload>("/api/markets", 120_000, EMPTY);
  const moveMin = typeof config.alertMin === "number" ? config.alertMin : 5;
  const sections = useMemo(() => (data.sections ?? []).filter((s) => s.rows.length), [data.sections]);
  const allRows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  const alerts: Alert[] = useMemo(() => {
    const out: Alert[] = [];
    for (const r of allRows) {
      if (r.changePct == null) continue;
      const mag = Math.abs(r.changePct);
      if (mag < moveMin) continue;
      out.push({
        id: `mkt-${r.id}`,
        severity: mag >= moveMin * 2 ? "critical" : "warn",
        text: `${r.symbol ?? r.name} ${r.changePct >= 0 ? "+" : ""}${r.changePct}%`,
        ref: r.id,
      });
    }
    return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]).slice(0, 4);
  }, [allRows, moveMin]);

  const report = useWidgetReport();
  useEffect(() => {
    report({ alerts, count: allRows.length, freshLabel: "live" });
  }, [alerts, allRows.length, report]);

  if (status === "loading" && allRows.length === 0) return <p className="tn-w-empty">Loading markets…</p>;
  if (allRows.length === 0) return <p className="tn-w-empty">Markets unavailable.</p>;

  return (
    <div>
      {sections.map((sec) => (
        <div key={sec.key}>
          <div className="tn-w-muted" style={{ margin: "6px 0 2px", fontWeight: 600 }}>{sec.label}</div>
          <ul className="tn-w-list">
            {sec.rows.map((r) => (
              <li key={r.id}>
                <span className="tn-w-strong">{r.symbol ?? r.name}</span>{" "}
                <span className="tn-w-num">{r.value}</span>
                {r.changePct != null && (
                  <span style={{ color: r.changePct >= 0 ? "#16a34a" : "#dc2626" }}>
                    {" "}
                    {r.changePct >= 0 ? "+" : ""}
                    {r.changePct}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export const MARKETS_WIDGET = {
  id: "markets",
  title: "Markets",
  icon: "📈",
  category: "Markets",
  defaultHeight: 300,
  defaultConfig: {},
  component: MarketsBody,
};
registerWidget(MARKETS_WIDGET);
