"use client";
// Cameras focus view — the traffic-camera console. The docked widget only sees
// map-loaded cameras (loadedCamerasStore); this detail fetches the full enriched
// /api/cameras list via useCameras(), then renders deep: a coverage-honesty masthead
// with a count sparkline, a per-operator coverage bar, operator/region filters, a
// region map, still + click-to-activate live camera walls (HLS concurrency-capped),
// a sortable table with a per-camera CameraDetail dossier, and an attribution +
// export footer. All snapshots go strictly through /api/proxy?id= (still) and
// /api/hls?id= (live) via CameraImage / CameraVideo / CameraDetail — never a raw
// upstream URL (SSRF). Coverage + concurrency maths live in unit-tested lib/cameras/.
import { useEffect, useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { useCameras } from "@/lib/cameras/useCameras";
import { coverage } from "@/lib/cameras/coverage";
import { recordSeries, seriesSamples } from "@/lib/series";
import { deltaOf } from "@/lib/widgets/history";
import { Chart, type ChartPoint } from "@/components/Chart";
import InsetMap from "@/components/InsetMap";
import type { InsetPoint } from "@/lib/map/inset";
import { useCameraFilter, cameraFilterStore } from "@/lib/cameraFilter";

type SortKey = "name" | "operator" | "region";

export default function CamerasDetail(_props: WidgetDetailProps) {
  const { cameras, status, updatedAt } = useCameras();
  const cov = useMemo(() => coverage(cameras), [cameras]);
  const total = cov.total;

  // Filter / sort / dossier state — consumed by the panels + table added in the
  // later tasks. Declared here as the skeleton (no noUnusedLocals) so the component
  // grows in place.
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("operator");
  const [dir, setDir] = useState<1 | -1>(1);

  // Operator (per-source) + live-only filtering, reusing the SAME cameraFilterStore
  // the globe/legend drive. NOTE: `passes` lives on the STORE (not the state object
  // useCameraFilter returns); we read the reactive state as the memo trigger and call
  // cameraFilterStore.passes with the current live state (mirrors WorldMap.tsx).
  const filter = useCameraFilter();
  const filtered = useMemo(
    () => cameras.filter((c) => cameraFilterStore.passes(c.source, c.live)),
    [cameras, filter],
  );
  const mapPoints: InsetPoint[] = useMemo(
    () => filtered.map((c) => ({ lat: c.lat, lon: c.lon, id: c.id, props: { name: c.name } })),
    [filtered],
  );

  // Count sparkline: only stamp the series ONCE REAL DATA HAS ARRIVED (the W4 review
  // fix). The initial feed is empty and its updatedAt is null; even after a poll,
  // recording a count=0 from an empty list would persist a spurious zero. `stamp` is
  // null until cameras exist, so the `if (stamp)` guards below never fire on empties.
  const stamp = cameras.length > 0 ? updatedAt : null;
  useEffect(() => {
    if (stamp) recordSeries("cam:count", total, stamp);
  }, [stamp, total]);

  // Read the persisted series AND fold in the CURRENT poll's live count — recordSeries
  // only writes in a post-commit effect and lib/series has no React subscription, so
  // without folding it in the delta/sparkline would trail the count beside them by one
  // poll (exactly as signals.detail.tsx / aviation.detail.tsx do).
  const samples = useMemo(() => {
    const base = seriesSamples("cam:count");
    const last = base[base.length - 1];
    if (stamp && (!last || last.t !== stamp || last.n !== total)) {
      return [...base, { t: stamp, n: total }];
    }
    return base;
  }, [stamp, total]);
  const spark: ChartPoint[] = useMemo(() => samples.map((s) => ({ x: s.t, y: s.n })), [samples]);
  const delta = useMemo(() => deltaOf(samples), [samples]);

  const freshAge = updatedAt ? `${Math.max(0, Math.round((Date.now() - updatedAt) / 60000))}m ago` : "—";

  return (
    <div className="tn-cm">
      <header className="tn-cm-head">
        <div className="tn-cm-title">Camera network</div>
        <div className="tn-cm-stat">
          <b>{total}</b> cameras · {cov.live} live · {cov.still} still · {cov.offline} offline · updated {freshAge}
          {delta !== 0 && (
            <span className={`tn-cm-delta ${delta > 0 ? "up" : "down"}`}> {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</span>
          )}
        </div>
        {spark.length >= 2 && <div className="tn-cm-spark"><Chart points={spark} height={40} up={null} /></div>}
      </header>

      {status === "loading" && cameras.length === 0 && <p className="tn-w-empty">Loading cameras…</p>}
      {status === "error" && cameras.length === 0 && <p className="tn-w-empty">Could not load cameras.</p>}
      {status === "idle" && cameras.length === 0 && <p className="tn-w-empty">No cameras loaded.</p>}

      {cameras.length > 0 && (
        <div className="tn-cm-cov">
          {cov.byOperator.map((o) => (
            <span
              key={o.source}
              className="tn-cm-cov-chip"
              title={`${o.source}: ${o.live} live · ${o.still} still · ${o.offline} offline`}
            >
              <b>{o.source}</b> · {o.live}▶ / {o.still}▦ / {o.offline}✕
            </span>
          ))}
        </div>
      )}

      {cameras.length > 0 && (
        <div className="tn-cm-filters">
          <div className="tn-cm-filter-row">
            <span className="tn-cm-filter-label">Operators</span>
            {cov.byOperator.map((o) => {
              const on = filter.regions[o.source] ?? true;
              return (
                <button
                  key={o.source}
                  className={`tn-cm-fchip ${on ? "active" : "off"}`}
                  onClick={() => cameraFilterStore.toggleRegion(o.source)}
                >
                  {o.source} · {o.total}
                </button>
              );
            })}
          </div>
          <div className="tn-cm-filter-row">
            <span className="tn-cm-filter-label">Live</span>
            <button
              className={`tn-cm-fchip ${filter.liveOnly ? "active" : ""}`}
              onClick={() => cameraFilterStore.setLiveOnly(!filter.liveOnly)}
            >
              Live streams only
            </button>
          </div>
        </div>
      )}

      {cameras.length > 0 && (
        <div className="tn-cm-panels">
          <div className="tn-cm-panel">
            <h3>Locations <span className="tn-cm-count">{filtered.length} shown</span></h3>
            {mapPoints.length > 0
              ? <InsetMap points={mapPoints} height={240} onSelect={(id) => setOpenId(id)} />
              : <p className="tn-w-empty">No cameras match this filter.</p>}
          </div>
        </div>
      )}

      <footer className="tn-cm-foot">
        <span className="tn-cm-attr">Traffic cameras · see each camera for its licence.</span>
      </footer>
    </div>
  );
}
