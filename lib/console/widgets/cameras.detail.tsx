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
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { useCameras, type CameraRow } from "@/lib/cameras/useCameras";
import { coverage, byWallPriority } from "@/lib/cameras/coverage";
import { recordSeries, seriesSamples } from "@/lib/series";
import { deltaOf } from "@/lib/widgets/history";
import { Chart, type ChartPoint } from "@/components/Chart";
import InsetMap from "@/components/InsetMap";
import type { InsetPoint } from "@/lib/map/inset";
import { useCameraFilter, cameraFilterStore } from "@/lib/cameraFilter";
import { CameraImage } from "@/components/CameraImage";
import { CameraVideo } from "@/components/CameraVideo";
import { CameraDetail } from "@/components/CameraDetail";
import { hlsSlots, useHlsActive, HLS_CAP } from "@/lib/cameras/concurrency";
import { msUntilRefresh, formatCountdown, sampledAgeMs } from "@/lib/cameras/freshness";
import { useNow, formatAge } from "@/lib/shell/useNow";
import { toCsv, toGeoJson, downloadText, exportFilename } from "@/lib/export";
import type { WorldObject } from "@/lib/world";

type SortKey = "name" | "operator" | "region";

// The registry merges thousands of cameras (TfL ~900, Digitraffic ~2000, …). The
// still wall renders one refreshing <img> (a /api/proxy request) per tile, so it is
// bounded — a wall of thousands would storm the proxy and the browser. Live players
// are capped separately (HLS_CAP). The table caps its DOM rows for the same reason;
// both show an honest "showing N of M — refine with filters" note.
const WALL_CAP = 18;
const TABLE_CAP = 300;

function toWorldObject(c: CameraRow): WorldObject {
  return { kind: "camera", id: c.id, label: c.name, lat: c.lat, lon: c.lon, meta: { available: c.available } };
}

// One tile in the still/live wall. Defaults to a still <img> (CameraImage → the
// SSRF-safe /api/proxy?id=); a live camera gets a "▶ Live" button that activates an
// HLS slot (capped, oldest-evicted in concurrency.ts) and swaps to CameraVideo
// (/api/hls?id=). Offline feeds show an honest placeholder — never a raw upstream URL.
function CameraTile({ camera, now }: { camera: CameraRow; now: number }) {
  const active = useHlsActive(camera.id);
  const isLive = camera.live && camera.available;
  const isStill = camera.available && !camera.live;
  const mountedAt = useRef(Date.now()).current;
  const nextFrame = isStill ? formatCountdown(msUntilRefresh(mountedAt, camera.refreshSeconds, now)) : null;
  const age = sampledAgeMs(camera.lastSampledAt, now);

  // Free this camera's shared HLS slot when the tile leaves the wall (filtered out /
  // unmounted). CameraVideo already tears down its own hls.js instance on unmount, but
  // without this the id lingers in hlsSlots.active and the "N/6 live" honesty counter
  // over-reports players that are no longer on screen.
  useEffect(() => () => { hlsSlots.deactivate(camera.id); }, [camera.id]);

  return (
    <div className="tn-cm-tile">
      <div className="tn-cm-shot">
        {!camera.available ? (
          <div className="tn-cm-offline">Feed offline</div>
        ) : isLive && active ? (
          <>
            <button className="tn-cm-live-btn" onClick={() => hlsSlots.deactivate(camera.id)}>◼ Stop</button>
            <CameraVideo id={camera.id} alt={camera.name} attribution={camera.attribution} license={camera.license} refreshSeconds={camera.refreshSeconds} />
          </>
        ) : (
          <>
            {isLive && <button className="tn-cm-live-btn" onClick={() => hlsSlots.activate(camera.id)}>▶ Live</button>}
            <CameraImage id={camera.id} alt={camera.name} attribution={camera.attribution} license={camera.license} refreshSeconds={camera.refreshSeconds} />
          </>
        )}
      </div>
      <div className="tn-cm-cap">
        <span className="tn-cm-cap-name">{camera.name}</span>
        <span className="tn-cm-cap-sub">
          {camera.source}
          {isLive ? " · ▶ live" : isStill ? ` · still · next ${nextFrame}` : " · offline"}
          {age != null && ` · sampled ${formatAge(age)} ago`}
        </span>
      </div>
    </div>
  );
}

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

  // 1s tick drives the per-tile still-refresh countdowns + sampled ages.
  const now = useNow(1000);
  // Live-player count for the "N/6 live" honesty counter (shared HLS slot store).
  const liveActive = useSyncExternalStore(hlsSlots.subscribe, hlsSlots.get, hlsSlots.get);

  // Wall = a bounded, most-interesting-first slice: working-live, then working-still,
  // then offline last. Gate "live" on availability — an offline feed can still carry an
  // allowlisted stream URL (live=true, available=false), and ranking those ahead of
  // working stills would fill the bounded wall with "Feed offline" tiles.
  const wall = useMemo(
    () => [...filtered].sort(byWallPriority).slice(0, WALL_CAP),
    [filtered],
  );

  // Sortable table (name / operator / region), capped for DOM sanity.
  const rows = useMemo(() => {
    const val = (c: CameraRow) => (sortKey === "name" ? c.name : sortKey === "operator" ? c.source : c.region ?? "");
    return [...filtered].sort((a, b) => val(a).localeCompare(val(b)) * dir).slice(0, TABLE_CAP);
  }, [filtered, sortKey, dir]);
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setDir(1); }
  };
  const sortMark = (k: SortKey) => (sortKey === k ? (dir === 1 ? " ↑" : " ↓") : "");

  // Export the FILTERED set (what's on screen). Per-operator licences ride on each
  // Camera.attribution/license, so the footer just names the distinct operators and
  // points to the per-camera licence (surfaced in the dossier's AttributionBadge).
  const operators = useMemo(() => cov.byOperator.map((o) => o.source).join(", "), [cov]);
  const exportRows = useMemo(
    () => filtered.map((c) => ({
      id: c.id, name: c.name, source: c.source, region: c.region ?? "",
      lat: c.lat, lon: c.lon, live: c.live, available: c.available,
    })),
    [filtered],
  );
  const exportGeo = useMemo(
    () => filtered.map((c) => ({
      lat: c.lat, lon: c.lon,
      properties: { name: c.name, source: c.source, live: c.live, available: c.available },
    })),
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

      {filtered.length > 0 && (
        <div className="tn-cm-panel">
          <h3>
            Camera wall
            <span className="tn-cm-count">
              {liveActive.length}/{HLS_CAP} live · showing {wall.length} of {filtered.length}
            </span>
          </h3>
          <div className="tn-cm-wall">
            {wall.map((c) => <CameraTile key={c.id} camera={c} now={now} />)}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <table className="tn-cm-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort("name")}>Name{sortMark("name")}</th>
              <th className="sortable" onClick={() => toggleSort("operator")}>Operator{sortMark("operator")}</th>
              <th className="sortable" onClick={() => toggleSort("region")}>Region{sortMark("region")}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const isOpen = openId === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className="tn-cm-row" onClick={() => setOpenId(isOpen ? null : c.id)}>
                    <td className="tn-w-strong">{c.name}</td>
                    <td className="tn-w-muted">{c.source}</td>
                    <td>{c.region ?? "—"}</td>
                    <td>{!c.available ? "Offline" : c.live ? "▶ Live" : "Still"}</td>
                  </tr>
                  {isOpen && (
                    <tr className="tn-cm-drill">
                      <td colSpan={4}><CameraDetail object={toWorldObject(c)} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {filtered.length > TABLE_CAP && (
        <p className="tn-w-empty">Showing the first {TABLE_CAP} of {filtered.length} — refine with the filters above.</p>
      )}

      <footer className="tn-cm-foot">
        <span className="tn-cm-attr">
          {operators
            ? `Operators: ${operators} · see each camera for its licence.`
            : "Traffic cameras · see each camera for its licence."}
        </span>
        <span className="tn-cm-actions">
          <button
            disabled={exportRows.length === 0}
            onClick={() => downloadText(`${exportFilename("cameras", Date.now())}.csv`, "text/csv", toCsv(exportRows))}
          >⬇ CSV</button>
          <button
            disabled={exportGeo.length === 0}
            onClick={() => downloadText(`${exportFilename("cameras", Date.now())}.geojson`, "application/geo+json", toGeoJson(exportGeo))}
          >⬇ GeoJSON</button>
        </span>
      </footer>
    </div>
  );
}
