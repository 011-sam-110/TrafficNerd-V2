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
//
// M20 ops upgrade: rows are now clickable (fly the globe + open the dossier, via
// lib/events/openEvent) and the long feed collapses into region/type clusters with
// counts (persisted per widget instance in `config`). Pure grouping lives in
// lib/events/regions.ts; pure view-pref reads in lib/events/opsConfig.ts.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_SOURCES } from "@/lib/events/sources";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedInput, type FeedSort } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { useTimeWindow, windowMsFor } from "@/lib/shell/timeWindow";
import { useNow } from "@/lib/shell/useNow";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { shellLayoutStore } from "@/lib/console/store";
import { runAlertRule } from "@/lib/console/alerts";
import { eventAlerts, type EventLite } from "@/lib/console/widgets/events.rules";
import type { SeverityTier } from "@/lib/events/model";
import type { NormalizedEvent } from "@/lib/events/model";
import type { SignalFeature } from "@/lib/signals/types";
import { groupByRegion, groupByType, type EventGroup } from "@/lib/events/regions";
import { readGroupBy, readCollapsed, isCollapsed, toggleCollapsed, type GroupBy } from "@/lib/events/opsConfig";
import { openEvent } from "@/lib/events/openEvent";
import EventsDetail from "@/lib/console/widgets/events.detail";

const GROUP_TABS: { id: GroupBy; label: string }[] = [
  { id: "region", label: "Region" },
  { id: "type", label: "Type" },
  { id: "none", label: "Flat" },
];

function EventRow({
  e,
  feature,
  flashed,
  onOpen,
}: {
  e: NormalizedEvent;
  feature?: SignalFeature;
  flashed: boolean;
  onOpen: (e: NormalizedEvent, f?: SignalFeature) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`tn-ev-row${flashed ? " is-flash" : ""}`}
        onClick={() => onOpen(e, feature)}
        title={`${e.title} — ${e.place.name}\nClick to fly the map here`}
      >
        <span className={`tn-w-sev tn-sev-${e.severity.tier}`}>{e.severity.tier}</span>
        <b className="tn-w-kind">{e.type}</b>
        <span className="tn-w-place">{e.place.name}</span>
        {e.magnitude && (
          <span className="tn-w-mag">
            {e.magnitude.value}
            {e.magnitude.unit}
          </span>
        )}
      </button>
    </li>
  );
}

function EventsBody({ instanceId, config }: WidgetBodyProps) {
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
  const groupBy = readGroupBy(config);
  const collapsed = readCollapsed(config);

  const projected = useMemo(
    () =>
      projectEventFeed(inputs, scope, windowMsFor(win), now, {
        types: null,
        minTier,
        sort: sort === "nearest" && !scope.center ? "severity" : sort,
      }),
    [inputs, scope, win, now, minTier, sort],
  );

  // Join back to the raw SignalFeature so a row-click opens the same dossier a map
  // click would (source label carried for the dossier credit).
  const featureIndex = useMemo(() => {
    const m = new Map<string, { feature: SignalFeature; sourceLabel: string }>();
    for (const s of EVENT_SOURCES) for (const f of bySource[s.id] ?? []) m.set(f.id, { feature: f, sourceLabel: s.label });
    return m;
  }, [bySource]);

  // Row flash on click (a short highlight so the eye stays anchored while the map flies).
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const onOpen = useCallback((e: NormalizedEvent, f?: SignalFeature) => {
    const hit = featureIndex.get(e.id);
    openEvent(e, f ?? hit?.feature, hit?.sourceLabel);
    setFlashId(e.id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1200);
  }, [featureIndex]);

  const setGroupBy = (g: GroupBy) => shellLayoutStore.configure(instanceId, { evGroupBy: g });
  const onToggleGroup = (key: string) =>
    shellLayoutStore.configure(instanceId, { evCollapsed: toggleCollapsed(collapsed, groupBy, key) });

  const groups: EventGroup[] = useMemo(() => {
    if (groupBy === "region") return groupByRegion(projected.rows);
    if (groupBy === "type") return groupByType(projected.rows);
    return [{ key: "all", label: "All events", events: projected.rows }];
  }, [groupBy, projected.rows]);

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

  const flat = groupBy === "none";

  return (
    <div className="tn-ev">
      <div className="tn-ev-tabs" role="tablist" aria-label="Group events by">
        {GROUP_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={groupBy === t.id}
            className={`tn-ev-tab${groupBy === t.id ? " is-active" : ""}`}
            onClick={() => setGroupBy(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {flat ? (
        <ul className="tn-w-list">
          {groups[0].events.slice(0, 200).map((e) => {
            const hit = featureIndex.get(e.id);
            return <EventRow key={e.id} e={e} feature={hit?.feature} flashed={flashId === e.id} onOpen={onOpen} />;
          })}
        </ul>
      ) : (
        <div className="tn-ev-groups">
          {groups.map((g) => {
            const open = !isCollapsed(collapsed, groupBy, g.key);
            return (
              <section key={g.key} className="tn-ev-group">
                <button
                  type="button"
                  className="tn-ev-group-h"
                  aria-expanded={open}
                  onClick={() => onToggleGroup(g.key)}
                >
                  <span className={`tn-ev-chev${open ? " is-open" : ""}`} aria-hidden>▸</span>
                  <span className="tn-ev-group-label">{g.label}</span>
                  <span className="tn-ev-group-count">{g.events.length}</span>
                </button>
                {open && (
                  <ul className="tn-w-list">
                    {g.events.slice(0, 200).map((e) => {
                      const hit = featureIndex.get(e.id);
                      return <EventRow key={e.id} e={e} feature={hit?.feature} flashed={flashId === e.id} onOpen={onOpen} />;
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const EVENTS_WIDGET = {
  id: "events",
  title: "Disasters & Events",
  icon: "🌎",
  category: "Events",
  defaultHeight: 320,
  defaultConfig: { minTier: "S1", sort: "severity", evGroupBy: "region" },
  component: EventsBody,
  detail: EventsDetail,
  capabilities: { filter: true, sort: true },
};
registerWidget(EVENTS_WIDGET);
