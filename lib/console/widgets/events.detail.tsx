// lib/console/widgets/events.detail.tsx
"use client";
// Events focus view. Reuses the SAME feed pipeline as the docked widget
// (useEventFeeds → projectEventFeed) but renders deep: a tier/type triage header,
// a feed grouped by region OR hazard type with honest per-domain metric lines
// joined back to the raw SignalFeature props, a recency chart, an event map, and
// export. Rows are clickable — they fly the globe and open the same dossier a map
// click would (lib/events/openEvent). Grouping + collapse state persist per widget
// instance in `config` (shared with the compact widget via lib/events/opsConfig).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { EVENT_SOURCES } from "@/lib/events/sources";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedInput } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { useTimeWindow, windowMsFor } from "@/lib/shell/timeWindow";
import { useNow } from "@/lib/shell/useNow";
import { shellLayoutStore } from "@/lib/console/store";
import { SEVERITY_COLOR, type SeverityTier, type NormalizedEvent } from "@/lib/events/model";
import type { SignalFeature } from "@/lib/signals/types";
import { countBy } from "@/lib/widgets/buckets";
import { eventMetricLine } from "@/lib/widgets/eventMetrics";
import { timeBins } from "@/lib/widgets/buckets";
import { Chart, type ChartPoint } from "@/components/Chart";
import InsetMap from "@/components/InsetMap";
import type { InsetPoint } from "@/lib/map/inset";
import { toCsv, toGeoJson, downloadText, exportFilename } from "@/lib/export";
import { groupByRegion, groupByType, type EventGroup } from "@/lib/events/regions";
import { readGroupBy, readCollapsed, isCollapsed, toggleCollapsed, type GroupBy } from "@/lib/events/opsConfig";
import { openEvent } from "@/lib/events/openEvent";

const TIERS: SeverityTier[] = ["S4", "S3", "S2", "S1", "S0"];
const GROUP_TABS: { id: GroupBy; label: string }[] = [
  { id: "region", label: "By region" },
  { id: "type", label: "By hazard" },
  { id: "none", label: "Flat" },
];

export default function EventsDetail({ instanceId, config }: WidgetDetailProps) {
  const scope = useScope();
  const win = useTimeWindow();
  const now = useNow(60_000);
  const { bySource, status, updatedAt } = useEventFeeds();

  const inputs: FeedInput[] = useMemo(
    () => EVENT_SOURCES.map((source) => ({ source, features: bySource[source.id] ?? [] })),
    [bySource],
  );
  const minTier = ((config.minTier as string) ?? "S1") as SeverityTier;
  const groupBy = readGroupBy(config);
  const collapsed = readCollapsed(config);

  const projected = useMemo(
    () => projectEventFeed(inputs, scope, windowMsFor(win), now, { types: null, minTier, sort: "severity" }),
    [inputs, scope, win, now, minTier],
  );

  // Join back to raw props for per-domain metrics (lost in NormalizedEvent) AND the
  // dossier a row-click opens.
  const featureIndex = useMemo(() => {
    const m = new Map<string, { feature: SignalFeature; sourceLabel: string }>();
    for (const s of EVENT_SOURCES) for (const f of bySource[s.id] ?? []) m.set(f.id, { feature: f, sourceLabel: s.label });
    return m;
  }, [bySource]);

  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const onOpen = useCallback((e: NormalizedEvent) => {
    const hit = featureIndex.get(e.id);
    openEvent(e, hit?.feature, hit?.sourceLabel);
    setFlashId(e.id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1200);
  }, [featureIndex]);
  const onSelectId = useCallback((id: string) => {
    const e = projected.rows.find((r) => r.id === id);
    if (e) onOpen(e);
  }, [projected.rows, onOpen]);

  const setGroupBy = (g: GroupBy) => shellLayoutStore.configure(instanceId, { evGroupBy: g });
  const onToggleGroup = (key: string) =>
    shellLayoutStore.configure(instanceId, { evCollapsed: toggleCollapsed(collapsed, groupBy, key) });

  const tierCounts = useMemo(() => countBy(projected.rows, (e) => e.severity.tier), [projected.rows]);
  const groups: EventGroup[] = useMemo(() => {
    if (groupBy === "region") return groupByRegion(projected.rows);
    if (groupBy === "type") return groupByType(projected.rows);
    return [{ key: "all", label: "All events", events: projected.rows }];
  }, [groupBy, projected.rows]);

  const recency: ChartPoint[] = useMemo(() => {
    const ts = projected.rows
      .map((e) => (e.occurredAt ? Date.parse(e.occurredAt) : NaN))
      .filter((n) => Number.isFinite(n));
    return timeBins(ts, 60 * 60_000, now, 24 * 60 * 60_000).map((b) => ({ x: b.start, y: b.count }));
  }, [projected.rows, now]);

  const mapPoints: InsetPoint[] = useMemo(
    () => projected.rows.map((e) => ({
      lat: e.geo.lat, lon: e.geo.lon, id: e.id, color: e.color,
      props: { title: e.title, tier: e.severity.tier },
    })),
    [projected.rows],
  );

  const perSource = useMemo(() => {
    const counts = countBy(projected.rows, (e) => e.source.id);
    return EVENT_SOURCES.map((s) => ({ id: s.id, label: s.label, attribution: s.attribution, count: counts[s.id] ?? 0 }));
  }, [projected.rows]);

  const exportRows = useMemo(
    () => projected.rows.map((e) => ({
      tier: e.severity.tier, type: e.type, title: e.title, place: e.place.name,
      metric: eventMetricLine(e.type, featureIndex.get(e.id)?.feature.props),
      lat: e.geo.lat, lon: e.geo.lon, occurredAt: e.occurredAt ?? "",
    })),
    [projected.rows, featureIndex],
  );
  const exportGeo = useMemo(
    () => projected.rows.map((e) => ({ lat: e.geo.lat, lon: e.geo.lon, properties: { tier: e.severity.tier, type: e.type, title: e.title } })),
    [projected.rows],
  );

  return (
    <div className="tn-evd">
      <div className="tn-evd-head">
        <div className="tn-evd-stat"><b>{projected.shown}</b> of {projected.total} events</div>
        <div className="tn-evd-scope">{scope.label}{updatedAt ? ` · updated ${Math.round((now - updatedAt) / 60000)}m ago` : ""}</div>
        <div className="tn-evd-tiers">
          {TIERS.map((t) => (
            <span key={t} className="tn-evd-tier" style={{ borderColor: SEVERITY_COLOR[t] }}>
              <i style={{ background: SEVERITY_COLOR[t] }} /> {t} {tierCounts[t] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className="tn-evd-panels">
        <div className="tn-evd-panel">
          <h3 className="tn-evd-group-h">Events over the last 24h</h3>
          {recency.some((p) => p.y > 0)
            ? <Chart points={recency} height={140} up={null} />
            : <p className="tn-w-empty">No timestamped events in the window.</p>}
        </div>
        <div className="tn-evd-panel">
          <h3 className="tn-evd-group-h">Locations · click a dot to fly</h3>
          {mapPoints.length > 0
            ? <InsetMap points={mapPoints} height={220} onSelect={onSelectId} />
            : <p className="tn-w-empty">No mappable events right now.</p>}
        </div>
      </div>

      {status === "loading" && projected.shown === 0 && <p className="tn-w-empty">Loading events…</p>}
      {projected.shown === 0 && status !== "loading" && (
        <p className="tn-w-empty">No events above {minTier} in {scope.label}.</p>
      )}

      {projected.shown > 0 && (
        <div className="tn-evd-toolbar">
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
        </div>
      )}

      {groups.map((g) => {
        const open = groupBy === "none" || !isCollapsed(collapsed, groupBy, g.key);
        return (
          <section key={g.key} className="tn-evd-group">
            {groupBy !== "none" && (
              <button
                type="button"
                className="tn-evd-group-toggle"
                aria-expanded={open}
                onClick={() => onToggleGroup(g.key)}
              >
                <span className={`tn-ev-chev${open ? " is-open" : ""}`} aria-hidden>▸</span>
                <span className="tn-evd-group-h">{g.label}</span>
                <span className="tn-ev-group-count">{g.events.length}</span>
              </button>
            )}
            {open && (
              <ul className="tn-evd-list">
                {g.events.map((e) => {
                  const metric = eventMetricLine(e.type, featureIndex.get(e.id)?.feature.props);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        className={`tn-evd-rowbtn${flashId === e.id ? " is-flash" : ""}`}
                        onClick={() => onOpen(e)}
                        title="Click to fly the map here and open the dossier"
                      >
                        <span className="tn-w-sev" style={{ background: SEVERITY_COLOR[e.severity.tier] }}>{e.severity.tier}</span>{" "}
                        <b>{e.title}</b> <span className="tn-w-place">{e.place.name}</span>
                        {metric && <span className="tn-evd-metric"> · {metric}</span>}
                      </button>
                      {e.link && <a className="tn-evd-src" href={e.link} target="_blank" rel="noreferrer"> source ↗</a>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <footer className="tn-evd-foot">
        <div className="tn-evd-sources">
          {perSource.map((s) => (
            <span key={s.id} className="tn-evd-source">{s.label} · {s.count} <i>({s.attribution})</i></span>
          ))}
        </div>
        <div className="tn-evd-export">
          <button
            disabled={exportRows.length === 0}
            onClick={() => downloadText(`${exportFilename("events", Date.now())}.csv`, "text/csv", toCsv(exportRows))}
          >⬇ CSV</button>
          <button
            disabled={exportGeo.length === 0}
            onClick={() => downloadText(`${exportFilename("events", Date.now())}.geojson`, "application/geo+json", toGeoJson(exportGeo))}
          >⬇ GeoJSON</button>
        </div>
      </footer>
    </div>
  );
}
