// lib/console/signals/signalCard.ts
// PURE projection for the GENERIC signal-monitor widget: SignalFeature[] →
// scoped, ranked rows + honest counts + a "needs attention" alert list.
//
// One component (lib/console/widgets/signals.tsx) renders EVERY registered signal
// source through this function, so the logic that turns a heterogeneous feed into
// a glanceable monitor card lives here, once, and is unit-tested. The component
// and the per-signal fetch hook are dumb shells around it.

import type { SignalFeature } from "@/lib/signals/types";
import { withinScope, type Scope } from "@/lib/shell/scope";
import type { Alert, AlertSeverity } from "@/lib/console/alerts";

export interface SignalRow {
  id: string;
  title: string;
  /** props.magnitude when it is a finite number (drives ranking + radius elsewhere). */
  magnitude?: number;
  ts?: string;
  link?: string;
}

export interface SignalProjection {
  rows: SignalRow[];
  /** Features emitted before scope trimming (for "N of M" honesty). */
  total: number;
  /** Features inside the active scope (the widget's headline count). */
  shown: number;
  alerts: Alert[];
}

export interface SignalCardConfig {
  /** Flag features whose numeric magnitude is at/above this as alerts. Off when unset. */
  alertMin?: number;
  /** Max rows rendered (default 60). */
  limit?: number;
}

const DEFAULT_LIMIT = 60;
const MAX_ALERTS = 4;
const SEV_RANK: Record<AlertSeverity, number> = { info: 0, warn: 1, critical: 2 };

/** A finite numeric magnitude from a feature's props, else undefined. */
function magnitudeOf(f: SignalFeature): number | undefined {
  const m = f.props?.magnitude;
  return typeof m === "number" && Number.isFinite(m) ? m : undefined;
}

/**
 * Soft, source-agnostic severity read from common alert-level props. Only fires
 * on words that unambiguously mean "severe" so the generic card never invents
 * urgency a source did not declare. Returns null when nothing qualifies.
 */
function severityFromProps(props: Record<string, unknown> | undefined): AlertSeverity | null {
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

function tsMillis(ts: string | undefined): number {
  if (!ts) return -Infinity; // undated sorts last under recency
  const t = Date.parse(ts);
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Project a single source's features into a ranked monitor card.
 * - Rows are trimmed to the active scope, then ranked: by magnitude (desc) when
 *   any feature carries one, otherwise by recency (desc; undated last).
 * - Alerts surface declared-severe features (always) plus, when `alertMin` is
 *   set, features at/above that magnitude — deduped, ranked, capped at 4.
 */
export function projectSignal(
  features: SignalFeature[],
  scope: Scope,
  config: SignalCardConfig,
): SignalProjection {
  const total = features.length;
  const scoped = features.filter((f) => withinScope(f.lat, f.lon, scope));

  const rows: SignalRow[] = scoped.map((f) => ({
    id: f.id,
    title: f.title,
    magnitude: magnitudeOf(f),
    ts: f.ts,
    link: f.link,
  }));

  const hasMagnitude = rows.some((r) => r.magnitude != null);
  rows.sort((a, b) => {
    if (hasMagnitude) {
      const diff = (b.magnitude ?? -Infinity) - (a.magnitude ?? -Infinity);
      if (diff !== 0) return diff;
    }
    return tsMillis(b.ts) - tsMillis(a.ts);
  });

  // Alerts — keyed by feature id so magnitude + prop-severity hits collapse.
  const alertMap = new Map<string, Alert>();
  const consider = (f: SignalFeature, severity: AlertSeverity, mag?: number) => {
    const prev = alertMap.get(f.id);
    if (prev && SEV_RANK[prev.severity] >= SEV_RANK[severity]) return;
    const tail = mag != null ? ` · ${mag}` : "";
    alertMap.set(f.id, { id: `sig-${f.id}`, severity, text: `${f.title}${tail}`, ref: f.id });
  };
  for (const f of scoped) {
    const sev = severityFromProps(f.props);
    if (sev) consider(f, sev);
    if (config.alertMin != null) {
      const mag = magnitudeOf(f);
      if (mag != null && mag >= config.alertMin) {
        consider(f, mag >= config.alertMin + 2 ? "critical" : "warn", mag);
      }
    }
  }
  const alerts = [...alertMap.values()]
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])
    .slice(0, MAX_ALERTS);

  const limit = config.limit ?? DEFAULT_LIMIT;
  return { rows: rows.slice(0, limit), total, shown: scoped.length, alerts };
}
