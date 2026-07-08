"use client";
// Signals focus view — ONE parameterised template covering every registered signal
// layer. makeSignalDetail(source) mirrors makeSignalBody(source): it reuses the SAME
// live pipeline (useSignalFeed → projectSignal) but renders deep — masthead + count
// sparkline, source map, honest magnitude/severity + time distributions, a sortable
// feature table with per-row props drill-down, attribution, and export/show-on-map.
import { Fragment, useEffect, useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import type { SignalSource } from "@/lib/signals/types";
import { useSignalFeed } from "@/lib/console/signals/useSignalFeed";
import { useScope, withinScope } from "@/lib/shell/scope";
import { recordSeries, seriesSamples } from "@/lib/series";
import { deltaOf } from "@/lib/widgets/history";
import { Chart, type ChartPoint } from "@/components/Chart";
import InsetMap from "@/components/InsetMap";
import type { InsetPoint } from "@/lib/map/inset";
import { timeBins } from "@/lib/widgets/buckets";
import { toCsv, toGeoJson, downloadText, exportFilename } from "@/lib/export";
import { signalsStore } from "@/lib/signals/store";
import { shellLayoutStore } from "@/lib/console/store";
import { openSignalFeature } from "@/lib/widgets/openSignal";
import { humaniseKey } from "@/lib/text/humanise";
import { distribution, timeModel, sortFeatures, type SortKey } from "@/lib/console/signals/signalDetail";

// Sources whose upstream needs a key that may be unset — surface an honest dormant note.
const KEYED = new Set(["acled", "firms", "aisstream", "openaq", "reliefweb", "entsoe"]);

export function makeSignalDetail(source: SignalSource) {
  function SignalDetailView(_props: WidgetDetailProps) {
    const scope = useScope();
    const { features, status, updatedAt } = useSignalFeed(source.id, source.refreshMs);
    const [sortKey, setSortKey] = useState<SortKey>("magnitude");
    const [dir, setDir] = useState<1 | -1>(-1);
    const [open, setOpen] = useState<string | null>(null);

    const scoped = useMemo(() => features.filter((f) => withinScope(f.lat, f.lon, scope)), [features, scope]);

    // Wire count-history recording (spec: no signal records into the series yet).
    useEffect(() => {
      if (updatedAt) recordSeries(`sig:${source.id}`, scoped.length, updatedAt);
    }, [updatedAt, scoped.length]);

    const spark: ChartPoint[] = useMemo(
      () => seriesSamples(`sig:${source.id}`).map((s) => ({ x: s.t, y: s.n })),
      [updatedAt, scoped.length],
    );
    const delta = useMemo(() => deltaOf(seriesSamples(`sig:${source.id}`)), [updatedAt, scoped.length]);

    const rows = useMemo(() => sortFeatures(scoped, sortKey, dir), [scoped, sortKey, dir]);
    const dist = useMemo(() => distribution(scoped), [scoped]);
    const tm = useMemo(() => timeModel(scoped), [scoped]);
    const now = Date.now();

    const distPoints: ChartPoint[] = dist.bins.map((b, i) => ({ x: i, y: b.count }));
    const timePoints: ChartPoint[] = timeBins(tm.values, 60 * 60_000, now, 24 * 60 * 60_000).map((b) => ({ x: b.start, y: b.count }));
    const mapPoints: InsetPoint[] = scoped.map((f) => ({ lat: f.lat, lon: f.lon, id: f.id, color: f.color ?? source.color, props: { title: f.title } }));
    const freshAge = updatedAt ? `${Math.max(0, Math.round((now - updatedAt) / 60000))}m ago` : "—";

    const exportRows = rows.map((f) => ({ id: f.id, title: f.title, magnitude: f.props?.magnitude ?? "", lat: f.lat, lon: f.lon, ts: f.ts ?? "", link: f.link ?? "" }));
    const exportGeo = rows.map((f) => ({ lat: f.lat, lon: f.lon, properties: { id: f.id, title: f.title, ...(f.props ?? {}) } }));

    const showOnMap = () => { signalsStore.set(source.id, true); shellLayoutStore.unfocus(); };

    return (
      <div className="tn-sd">
        <header className="tn-sd-head">
          <div className="tn-sd-title">{source.label}</div>
          <div className="tn-sd-stat"><b>{scoped.length}</b> of {features.length} in {scope.label} · updated {freshAge}
            {delta !== 0 && <span className={`tn-sd-delta ${delta > 0 ? "up" : "down"}`}> {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</span>}
          </div>
          {spark.length >= 2 && <div className="tn-sd-spark"><Chart points={spark} height={40} up={null} /></div>}
        </header>

        {status === "loading" && scoped.length === 0 && <p className="tn-w-empty">Loading {source.label}…</p>}
        {status !== "loading" && scoped.length === 0 && <p className="tn-w-empty">Nothing in {scope.label}.</p>}

        {scoped.length > 0 && (
          <div className="tn-sd-panels">
            <div className="tn-sd-panel">
              <h3>Locations</h3>
              {mapPoints.length > 0 ? <InsetMap points={mapPoints} height={200} onSelect={(id) => setOpen(id)} />
                : <p className="tn-w-empty">No mappable features.</p>}
            </div>
            <div className="tn-sd-panel">
              <h3>{dist.kind === "magnitude" ? "Magnitude distribution" : dist.kind === "severity" ? "Severity" : "Distribution"}</h3>
              {dist.kind !== "none" ? (
                <>
                  <div className="tn-sd-bars">
                    {dist.bins.map((b, i) => {
                      const max = Math.max(1, ...dist.bins.map((x) => x.count));
                      return <div key={i} className="tn-sd-bar" style={{ height: `${(b.count / max) * 100}%` }} title={`${b.label}: ${b.count}`} />;
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>{dist.bins.map((b, i) => <span key={i} className="tn-sd-bar-label" style={{ flex: 1 }}>{b.label}</span>)}</div>
                </>
              ) : <p className="tn-w-empty">This source declares no magnitude or severity.</p>}
            </div>
            <div className="tn-sd-panel">
              <h3>Over the last 24h {tm.undated > 0 && <span className="tn-sd-bar-label">· {tm.undated} undated</span>}</h3>
              {timePoints.some((p) => p.y > 0) ? <Chart points={timePoints} height={120} up={null} />
                : <p className="tn-w-empty">No timestamped features in the window.</p>}
            </div>
          </div>
        )}

        {scoped.length > 0 && (
          <table className="tn-sd-table">
            <thead>
              <tr>
                {(["magnitude", "title", "recency"] as SortKey[]).map((k) => (
                  <th key={k} onClick={() => { if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1)); else { setSortKey(k); setDir(-1); } }}>
                    {k === "recency" ? "When" : humaniseKey(k)}{sortKey === k ? (dir === -1 ? " ↓" : " ↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const entries = Object.entries(f.props ?? {}).filter(([, v]) => v != null && v !== "");
                const isOpen = open === f.id;
                return (
                  <Fragment key={f.id}>
                    <tr className="tn-sd-row" onClick={() => setOpen(isOpen ? null : f.id)}>
                      <td>{typeof f.props?.magnitude === "number" ? (f.props.magnitude as number) : "—"}</td>
                      <td>{f.title}</td>
                      <td>{f.ts ? new Date(f.ts).toISOString().slice(0, 16).replace("T", " ") : "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr className="tn-sd-drill">
                        <td colSpan={3}>
                          {entries.length > 0 ? (
                            <dl>{entries.map(([k, v]) => (<div key={k} style={{ display: "contents" }}><dt>{humaniseKey(k)}</dt><dd>{String(v)}</dd></div>))}</dl>
                          ) : <span className="tn-w-empty">No extra properties.</span>}
                          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                            <button className="tn-sd-actions" onClick={(e) => { e.stopPropagation(); openSignalFeature(f, source.label); shellLayoutStore.unfocus(); }} style={{ background: "none", border: 0, color: "var(--tn-accent)", cursor: "pointer", padding: 0 }}>Show on globe ↗</button>
                            {f.link && <a href={f.link} target="_blank" rel="noreferrer" style={{ color: "var(--tn-accent)" }}>Source ↗</a>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        <footer className="tn-sd-foot">
          <span className="tn-sd-attr">{source.attribution}{KEYED.has(source.id) && " · needs an API key (dormant when unset)"}</span>
          <span className="tn-sd-actions">
            <button onClick={showOnMap}>🗺 Show on map</button>
            <button disabled={!exportRows.length} onClick={() => downloadText(`${exportFilename(`signal-${source.id}`, Date.now())}.csv`, "text/csv", toCsv(exportRows))}>⬇ CSV</button>
            <button disabled={!exportGeo.length} onClick={() => downloadText(`${exportFilename(`signal-${source.id}`, Date.now())}.geojson`, "application/geo+json", toGeoJson(exportGeo))}>⬇ GeoJSON</button>
          </span>
        </footer>
      </div>
    );
  }
  return SignalDetailView;
}
