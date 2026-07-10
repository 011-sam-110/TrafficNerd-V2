"use client";
// Generic signal-monitor widgets — ONE component renders EVERY registered global
// signal source as its own monitor card, and the loop at the bottom registers one
// widget type per source. "Every data piece is a widget": adding a layer to
// lib/signals/registry.ts gives it a ⌘K-discoverable widget for free, no edits here.
//
// The card reuses the shared widget row classes (.tn-w-*) so it needs no new CSS,
// reads the global Scope, and reports its count + "needs attention" alerts through
// the same WidgetFrame contract as the bespoke widgets. Pure projection +
// per-source ranking/alerts live in lib/console/signals/signalCard.ts.

import { useEffect, useMemo } from "react";
import { SIGNALS } from "@/lib/signals/registry";
import type { SignalSource } from "@/lib/signals/types";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { useScope } from "@/lib/shell/scope";
import { projectSignal } from "@/lib/console/signals/signalCard";
import { signalHelp } from "@/lib/console/help";
import { useSignalFeed } from "@/lib/console/signals/useSignalFeed";
import { MetricBar } from "@/components/MetricBar";
import { makeSignalDetail } from "./signals.detail";

const GROUP_ICON: Record<string, string> = {
  Synthesis: "🧭",
  "Natural hazards": "🌋",
  "Space weather": "🌌",
  Space: "🚀",
  Infrastructure: "🛰",
  Intel: "📰",
  Conflict: "⚔",
  Environment: "🌿",
  "Civic safety": "🚨",
  "Cyber threat": "🛡",
  "Human cost": "🆘",
  Military: "🎖",
  Maritime: "🚢",
  Weather: "🌦",
};

function iconFor(source: SignalSource): string {
  return GROUP_ICON[source.group] ?? "📡";
}

function freshLabel(refreshMs: number): string {
  if (refreshMs <= 90_000) return "live";
  return `${Math.round(refreshMs / 60_000)}m`;
}

/** Compact "5m" / "2h" / "3d" since an ISO timestamp; "" when undated/unparsable. */
function relativeTime(ts: string | undefined, now: number): string {
  if (!ts) return "";
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function makeSignalBody(source: SignalSource) {
  function SignalBody({ config }: WidgetBodyProps) {
    const scope = useScope();
    const { features, status } = useSignalFeed(source.id, source.refreshMs);

    const projected = useMemo(
      () =>
        projectSignal(
          features,
          scope,
          { alertMin: typeof config.alertMin === "number" ? config.alertMin : undefined },
          source.metric,
        ),
      [features, scope, config],
    );

    const report = useWidgetReport();
    useEffect(() => {
      report({ alerts: projected.alerts, count: projected.shown, freshLabel: freshLabel(source.refreshMs) });
    }, [projected, report]);

    if (status === "loading" && projected.shown === 0) {
      return <p className="tn-w-empty">Loading {source.label}…</p>;
    }
    if (status === "error" && projected.shown === 0) {
      return <p className="tn-w-empty">{source.label} unavailable.</p>;
    }
    if (projected.shown === 0) {
      return <p className="tn-w-empty">Nothing in {scope.label}.</p>;
    }

    const now = Date.now();
    return (
      <ul className="tn-w-list">
        {projected.rows.map((r) => {
          const rel = relativeTime(r.ts, now);
          return (
            <li key={r.id}>
              {r.metric ? (
                <MetricBar value={r.metric.value} domain={r.metric.domain} color={r.color} label={r.metric.label} />
              ) : (
                <span className="tn-w-dot" style={{ background: r.color || "var(--tn-text-faint, #94a3b8)" }} aria-hidden />
              )}
              <span className="tn-w-place">{r.title}</span>
              {rel && <span className="tn-w-muted"> · {rel}</span>}
            </li>
          );
        })}
      </ul>
    );
  }
  return SignalBody;
}

// Register one widget type per registered signal source.
for (const source of SIGNALS) {
  registerWidget({
    id: `signal:${source.id}`,
    title: source.label,
    icon: iconFor(source),
    category: source.group,
    defaultHeight: 240,
    defaultConfig: {},
    component: makeSignalBody(source),
    detail: makeSignalDetail(source),
    help: signalHelp(source),
  });
}
