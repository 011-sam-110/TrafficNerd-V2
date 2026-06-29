// lib/events/adapter.ts
// SignalFeature → NormalizedEvent, plus the severity×recency ranking. The general
// form of lib/widgets/topEvents.ts (which this supersedes): the magnitude/place/
// time the rows need already ride in each feature — this surfaces them.

import type { SignalFeature } from "@/lib/signals/types";
import type { EventSource } from "@/lib/events/sources";
import {
  type NormalizedEvent,
  severityTier,
  severityRank,
  placeName,
  SEVERITY_COLOR,
} from "@/lib/events/model";

export function toEvent(f: SignalFeature, src: EventSource): NormalizedEvent {
  const raw = Number(f.props?.magnitude ?? 0);
  const tier = severityTier(raw);
  const event: NormalizedEvent = {
    id: f.id,
    type: src.type,
    title: f.title,
    place: { name: placeName(f.title, f.props) },
    geo: { lat: f.lat, lon: f.lon, precision: src.precision },
    occurredAt: f.ts ?? null,
    severity: { tier, raw },
    source: { id: src.id, label: src.label, attribution: src.attribution },
    link: f.link,
    color: SEVERITY_COLOR[tier],
  };
  if (src.magnitudeUnit && Number.isFinite(raw) && raw > 0) {
    event.magnitude = { value: raw, unit: src.magnitudeUnit };
  }
  return event;
}

/** Severity tier desc, then newest-first (undated sorts last). Mirrors topEventsRows. */
export function rankEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  return [...events].sort((a, b) => {
    const sev = severityRank(b.severity.tier) - severityRank(a.severity.tier);
    if (sev !== 0) return sev;
    const at = a.occurredAt ?? "";
    const bt = b.occurredAt ?? "";
    if (at < bt) return 1;
    if (at > bt) return -1;
    return 0;
  });
}
