// lib/widgets/eventFeed.ts
// PURE feed projection: SignalFeature[] (by source) → scoped, windowed, filtered,
// ranked NormalizedEvent[] + honest counts. The single place the feed's logic
// lives; the component and the hook are dumb shells around this.

import type { SignalFeature } from "@/lib/signals/types";
import type { EventSource } from "@/lib/events/sources";
import { type NormalizedEvent, type SeverityTier, type EventType, severityRank } from "@/lib/events/model";
import { toEvent, rankEvents } from "@/lib/events/adapter";
import { withinWindow } from "@/lib/shell/timeWindow";
import { withinScope, type Scope } from "@/lib/shell/scope";
import { haversineKm } from "@/lib/geo/haversine";

export type FeedSort = "severity" | "recent" | "nearest";

export interface FeedFilters {
  /** null = all types; otherwise the set to keep. */
  types: Set<EventType> | null;
  minTier: SeverityTier;
  sort: FeedSort;
}

export interface FeedInput {
  source: EventSource;
  features: SignalFeature[];
}

export interface ProjectedFeed {
  rows: NormalizedEvent[];
  /** Events emitted before scope/window/filter trimming (for the "N of M" honesty). */
  total: number;
  /** rows.length after trimming. */
  shown: number;
}

export function projectEventFeed(
  inputs: FeedInput[],
  scope: Scope,
  windowMs: number | null,
  now: number,
  filters: FeedFilters,
): ProjectedFeed {
  const all: NormalizedEvent[] = [];
  for (const { source, features } of inputs) {
    for (const f of features) all.push(toEvent(f, source));
  }
  const total = all.length;
  const floor = severityRank(filters.minTier);

  let rows = all.filter(
    (e) =>
      withinScope(e.geo.lat, e.geo.lon, scope) &&
      withinWindow(e.occurredAt, windowMs, now) &&
      severityRank(e.severity.tier) >= floor &&
      (filters.types == null || filters.types.has(e.type)),
  );

  if (filters.sort === "nearest" && scope.center) {
    const c = scope.center;
    rows = [...rows].sort(
      (a, b) =>
        haversineKm(c.lat, c.lon, a.geo.lat, a.geo.lon) -
        haversineKm(c.lat, c.lon, b.geo.lat, b.geo.lon),
    );
  } else if (filters.sort === "recent") {
    rows = [...rows].sort((a, b) => {
      const at = a.occurredAt ?? "";
      const bt = b.occurredAt ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0;
    });
  } else {
    rows = rankEvents(rows);
  }

  return { rows, total, shown: rows.length };
}
