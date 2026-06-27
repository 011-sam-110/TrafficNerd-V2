// Pure: merge hazard SignalFeature[] from several sources into one "Live Now"
// ranking. Sort by severity (props.magnitude, the shared 0–10 convention), then
// newest-first on ts, then cap. Each row carries a short `kind` chip label.

import type { SignalFeature } from "@/lib/signals/types";

export interface TopEventGroup {
  kind: string;
  features: SignalFeature[];
}

export interface TopEventRow {
  id: string;
  title: string;
  kind: string;
  severity: number;
  color: string;
  ts: string;
  lat: number;
  lon: number;
  feature: SignalFeature;
}

export function topEventsRows(groups: TopEventGroup[], cap = 12): TopEventRow[] {
  const all: TopEventRow[] = [];
  for (const g of groups) {
    for (const f of g.features) {
      all.push({
        id: f.id,
        title: f.title,
        kind: g.kind,
        severity: Number(f.props?.magnitude ?? 0),
        color: f.color ?? "#64748b",
        ts: f.ts ?? "",
        lat: f.lat,
        lon: f.lon,
        feature: f,
      });
    }
  }
  all.sort((a, b) => b.severity - a.severity || (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return all.slice(0, cap);
}
