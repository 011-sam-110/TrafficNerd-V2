// lib/console/widgets/events.tsx
// Disasters & Events widget.
//
// Integration notes — real projectEventFeed API (differs from task brief template):
//   FeedInput is { source: EventSource; features: SignalFeature[] } per source.
//   projectEventFeed(inputs, scope, windowMs, now, filters) returns ProjectedFeed.
//   Row (NormalizedEvent) → EventLite mapping:
//     r.id              → EventLite.id
//     r.type            → EventLite.type
//     r.severity.tier   → EventLite.tier   (NESTED in severity object, not r.tier)
//     r.title           → EventLite.title
//     r.magnitude?.value → EventLite.magnitude  (NESTED, optional number)
//   Display uses r.place.name for the human location label.
"use client";
import { useEffect, useMemo } from "react";
import { EVENT_SOURCES } from "@/lib/events/sources";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedInput, type FeedSort } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { useTimeWindow, windowMsFor } from "@/lib/shell/timeWindow";
import { useNow } from "@/lib/shell/useNow";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { runAlertRule } from "@/lib/console/alerts";
import { eventAlerts, type EventLite } from "@/lib/console/widgets/events.rules";
import type { SeverityTier } from "@/lib/events/model";

function EventsBody({ config }: WidgetBodyProps) {
  const scope = useScope();
  const win = useTimeWindow();
  const now = useNow(60_000);
  const { bySource, status } = useEventFeeds();

  // Exact pattern copied from components/shell/EventFeed.tsx.
  const inputs: FeedInput[] = useMemo(
    () => EVENT_SOURCES.map((source) => ({ source, features: bySource[source.id] ?? [] })),
    [bySource],
  );

  const minTier = ((config.minTier as string) ?? "S1") as SeverityTier;
  const sort = ((config.sort as string) ?? "severity") as FeedSort;

  const projected = useMemo(
    () =>
      projectEventFeed(inputs, scope, windowMsFor(win), now, {
        types: null,
        minTier,
        sort: sort === "nearest" && !scope.center ? "severity" : sort,
      }),
    [inputs, scope, win, now, minTier, sort],
  );

  // Map NormalizedEvent rows → EventLite for the alert rules.
  // Key field renames: r.severity.tier → tier; r.magnitude?.value → magnitude.
  const lite: EventLite[] = useMemo(
    () =>
      projected.rows.map((r) => ({
        id: r.id,
        type: r.type,
        tier: r.severity.tier,
        title: r.title,
        magnitude: r.magnitude?.value,
      })),
    [projected.rows],
  );

  const exportRows = useMemo(
    () =>
      projected.rows.map((r) => ({
        tier: r.severity.tier,
        type: r.type,
        title: r.title,
        place: r.place.name,
        magnitude: r.magnitude?.value ?? "",
        unit: r.magnitude?.unit ?? "",
        lat: r.geo.lat,
        lon: r.geo.lon,
      })),
    [projected.rows],
  );
  const exportGeo = useMemo(
    () =>
      projected.rows.map((r) => ({
        lat: r.geo.lat,
        lon: r.geo.lon,
        properties: { tier: r.severity.tier, type: r.type, title: r.title, place: r.place.name, magnitude: r.magnitude?.value },
      })),
    [projected.rows],
  );

  const report = useWidgetReport();
  useEffect(() => {
    report({
      alerts: runAlertRule(eventAlerts, lite, config),
      count: projected.shown,
      freshLabel: "5m",
      export: { rows: exportRows, geo: exportGeo, name: "events" },
    });
  }, [lite, projected.shown, report, config, exportRows, exportGeo]);

  if (status === "loading" && projected.shown === 0) {
    return <p className="tn-w-empty">Loading events…</p>;
  }
  if (projected.shown === 0) {
    return (
      <p className="tn-w-empty">
        No events above {minTier} in {scope.label}.
      </p>
    );
  }

  return (
    <ul className="tn-w-list">
      {projected.rows.slice(0, 100).map((r) => (
        <li key={r.id}>
          <span className={`tn-w-sev tn-sev-${r.severity.tier}`}>{r.severity.tier}</span>{" "}
          <b className="tn-w-kind">{r.type}</b>{" "}
          <span className="tn-w-place">{r.place.name}</span>
          {r.magnitude && (
            <span className="tn-w-mag">
              {" "}
              {r.magnitude.value}
              {r.magnitude.unit}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export const EVENTS_WIDGET = {
  id: "events",
  title: "Disasters & Events",
  icon: "🌎",
  category: "Events",
  defaultHeight: 320,
  defaultConfig: { minTier: "S1", sort: "severity" },
  component: EventsBody,
  capabilities: { filter: true, sort: true },
};
registerWidget(EVENTS_WIDGET);
