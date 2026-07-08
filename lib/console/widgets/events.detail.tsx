// lib/console/widgets/events.detail.tsx
"use client";
// Events focus view. Reuses the SAME feed pipeline as the docked widget
// (useEventFeeds → projectEventFeed) but renders deep: a tier/type triage header,
// a feed grouped by event type with honest per-domain metric lines joined back to
// the raw SignalFeature props, and (Task 10/11) a recency chart, event map and export.
import { useMemo } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { EVENT_SOURCES } from "@/lib/events/sources";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedInput } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { useTimeWindow, windowMsFor } from "@/lib/shell/timeWindow";
import { useNow } from "@/lib/shell/useNow";
import { SEVERITY_COLOR, type SeverityTier, type EventType } from "@/lib/events/model";
import type { SignalFeature } from "@/lib/signals/types";
import { countBy } from "@/lib/widgets/buckets";
import { eventMetricLine } from "@/lib/widgets/eventMetrics";
import { timeBins } from "@/lib/widgets/buckets";
import { Chart, type ChartPoint } from "@/components/Chart";
import InsetMap from "@/components/InsetMap";
import type { InsetPoint } from "@/lib/map/inset";
import { toCsv, toGeoJson, downloadText, exportFilename } from "@/lib/export";

const TIERS: SeverityTier[] = ["S4", "S3", "S2", "S1", "S0"];
const TYPE_LABEL: Partial<Record<EventType, string>> = { quake: "Quakes", disaster: "Disasters", cyclone: "Cyclones" };

export default function EventsDetail({ config }: WidgetDetailProps) {
  const scope = useScope();
  const win = useTimeWindow();
  const now = useNow(60_000);
  const { bySource, status, updatedAt } = useEventFeeds();

  const inputs: FeedInput[] = useMemo(
    () => EVENT_SOURCES.map((source) => ({ source, features: bySource[source.id] ?? [] })),
    [bySource],
  );
  const minTier = ((config.minTier as string) ?? "S1") as SeverityTier;

  const projected = useMemo(
    () => projectEventFeed(inputs, scope, windowMsFor(win), now, { types: null, minTier, sort: "severity" }),
    [inputs, scope, win, now, minTier],
  );

  // Join back to raw props for per-domain metrics (lost in NormalizedEvent).
  const featureById = useMemo(() => {
    const m = new Map<string, SignalFeature>();
    for (const s of EVENT_SOURCES) for (const f of bySource[s.id] ?? []) m.set(f.id, f);
    return m;
  }, [bySource]);

  const tierCounts = useMemo(() => countBy(projected.rows, (e) => e.severity.tier), [projected.rows]);
  const groups = useMemo(() => {
    const by = new Map<EventType, typeof projected.rows>();
    for (const e of projected.rows) { const g = by.get(e.type) ?? []; g.push(e); by.set(e.type, g); }
    return [...by.entries()];
  }, [projected.rows]);

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
      metric: eventMetricLine(e.type, featureById.get(e.id)?.props),
      lat: e.geo.lat, lon: e.geo.lon, occurredAt: e.occurredAt ?? "",
    })),
    [projected.rows, featureById],
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
          <h3 className="tn-evd-group-h">Locations</h3>
          {mapPoints.length > 0
            ? <InsetMap points={mapPoints} height={220} />
            : <p className="tn-w-empty">No mappable events right now.</p>}
        </div>
      </div>

      {status === "loading" && projected.shown === 0 && <p className="tn-w-empty">Loading events…</p>}
      {projected.shown === 0 && status !== "loading" && (
        <p className="tn-w-empty">No events above {minTier} in {scope.label}.</p>
      )}

      {groups.map(([type, rows]) => (
        <section key={type} className="tn-evd-group">
          <h3 className="tn-evd-group-h">{TYPE_LABEL[type] ?? type} · {rows.length}</h3>
          <ul className="tn-evd-list">
            {rows.map((e) => {
              const metric = eventMetricLine(e.type, featureById.get(e.id)?.props);
              return (
                <li key={e.id}>
                  <span className="tn-w-sev" style={{ background: SEVERITY_COLOR[e.severity.tier] }}>{e.severity.tier}</span>{" "}
                  <b>{e.title}</b> <span className="tn-w-place">{e.place.name}</span>
                  {metric && <span className="tn-evd-metric"> · {metric}</span>}
                  {e.link && <a className="tn-evd-src" href={e.link} target="_blank" rel="noreferrer"> source ↗</a>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

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
