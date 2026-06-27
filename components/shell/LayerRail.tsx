"use client";
// Left layer rail — the calm-light reframe of the ops-console left panel.
// Collapsible, persistent. Lists each world layer with an on/off toggle, a live
// tabular count, and a tiny source + freshness note. Cameras expand to the
// region + live-only sub-filters. Planned layers (Ships/Webcams/Weather) render
// disabled so the structure is visible without shipping dead toggles.
//
// Toggling a layer flips lib/layers — and because WorldMap mounts each data hook
// only while its layer is on, a hidden layer stops fetching/ticking entirely.

import { useState } from "react";
import {
  useLayers,
  layersStore,
  LAYER_PRESETS,
  ACTIVE_LAYERS,
  PLANNED_LAYERS,
  type LayerKey,
} from "@/lib/layers";
import { SIGNALS, signalsByGroup } from "@/lib/signals/registry";
import { signalsStore, useSignals, useSignalCounts } from "@/lib/signals/store";
import { useMetrics } from "@/lib/metrics";
import { useFreshness, classifyFreshness, freshnessAgeMs, type FreshSourceId } from "@/lib/freshness";
import { useCameraFilter, cameraFilterStore } from "@/lib/cameraFilter";
import { uiStore, useUI } from "@/lib/shell/ui";
import { coverageStore } from "@/lib/shell/coverage";
import { marketsStore } from "@/lib/shell/markets";
import { useNow, formatAge } from "@/lib/shell/useNow";
import { CAMERA_REGIONS, CAMERA_FEED_META } from "@/lib/icons/svg";

interface LayerMeta {
  name: string;
  group: string;
  accent: string;
  source: string;
  fresh?: FreshSourceId;
  planned?: boolean;
}

const LAYER_META: Record<LayerKey, LayerMeta> = {
  cameras: { name: "Cameras", group: "Ground", accent: "#0e7d97", source: "TfL · Caltrans · SCDOT · Digitraffic · 511 · DriveBC", fresh: "cameras" },
  planes: { name: "Planes", group: "Air", accent: "#d97706", source: "adsb.lol — live ADS-B", fresh: "planes" },
  satellites: { name: "Satellites", group: "Space", accent: "#7c3aed", source: "CelesTrak TLE · SGP4 (local)", fresh: "satellites" },
  ships: { name: "Ships", group: "Sea", accent: "#0d9488", source: "AIS vessels", planned: true },
  webcams: { name: "Webcams", group: "Ground", accent: "#ec4899", source: "Windy.com — global webcams", fresh: "webcams" },
  weather: { name: "Weather", group: "Sky", accent: "#0284c7", source: "Radar & events", planned: true },
};

function Toggle({ on, accent, onClick, label }: { on: boolean; accent: string; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="tn-toggle"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{ background: on ? accent : "var(--tn-toggle-off)" }}
    >
      <span className="tn-toggle-knob" style={{ left: on ? 18 : 2 }} />
    </button>
  );
}

function FreshNote({ fresh }: { fresh?: FreshSourceId }) {
  const records = useFreshness();
  const now = useNow(1000);
  if (!fresh) return null;
  const rec = records.find((r) => r.id === fresh);
  if (!rec) return null;
  const state = classifyFreshness(rec, now);
  const age = freshnessAgeMs(rec, now);
  const text = rec.local
    ? "live · local"
    : state === "unknown"
      ? "connecting…"
      : `updated ${formatAge(age)} ago`;
  return (
    <span className={`tn-fresh tn-fresh-${state}`}>
      <span className="tn-fresh-dot" aria-hidden />
      {text}
    </span>
  );
}

function CameraFilters() {
  const filter = useCameraFilter();
  const feeds = Object.values(CAMERA_FEED_META);
  return (
    <div className="tn-cam-filters">
      <div className="tn-subhead">Feed</div>
      <div className="tn-feed-row">
        {feeds.map((f) => (
          <span key={f.key} className="tn-feed-chip">
            {f.label}
          </span>
        ))}
        <button
          type="button"
          className="tn-liveonly"
          aria-pressed={filter.liveOnly}
          onClick={() => cameraFilterStore.setLiveOnly(!filter.liveOnly)}
        >
          <span className="tn-liveonly-dot" data-on={filter.liveOnly} />
          Live video only
        </button>
      </div>
      <div className="tn-subhead">Region — click to filter</div>
      <div className="tn-region-grid">
        {CAMERA_REGIONS.map((r) => {
          const on = filter.regions[r.source] ?? true;
          return (
            <button
              key={r.source}
              type="button"
              className="tn-region-chip"
              aria-pressed={on}
              title={`${on ? "Hide" : "Show"} ${r.label}`}
              style={{ opacity: on ? 1 : 0.4 }}
              onClick={() => cameraFilterStore.toggleRegion(r.source)}
            >
              <span className="tn-region-dot" style={{ background: r.color }} />
              <span style={{ textDecoration: on ? "none" : "line-through" }}>{r.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LayerRow({
  layerKey,
  count,
  expandable,
}: {
  layerKey: LayerKey;
  count: number | null;
  expandable?: boolean;
}) {
  const layers = useLayers();
  const meta = LAYER_META[layerKey];
  const [open, setOpen] = useState(false);
  const on = layers[layerKey];

  if (meta.planned) {
    return (
      <div className="tn-layer-row tn-layer-planned">
        <span className="tn-layer-dot" style={{ background: meta.accent }} />
        <div className="tn-layer-main">
          <span className="tn-layer-name">{meta.name}</span>
          <span className="tn-layer-source">{meta.source}</span>
        </div>
        <span className="tn-soon">soon</span>
      </div>
    );
  }

  return (
    <div className="tn-layer-row" style={{ opacity: on ? 1 : 0.55 }}>
      <button
        type="button"
        className="tn-layer-head"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
      >
        <span className="tn-layer-dot" style={{ background: meta.accent, boxShadow: on ? `0 0 7px ${meta.accent}88` : "none" }} />
        <div className="tn-layer-main">
          <span className="tn-layer-name">
            {meta.name}
            {expandable ? <span className="tn-layer-caret" data-open={open}>›</span> : null}
          </span>
          <span className="tn-layer-source">{meta.source}</span>
          <FreshNote fresh={meta.fresh} />
        </div>
      </button>
      <span className="tn-layer-count tn-num">{count == null ? "—" : count.toLocaleString()}</span>
      <Toggle on={on} accent={meta.accent} label={`Toggle ${meta.name}`} onClick={() => layersStore.toggle(layerKey)} />
      {expandable && open && on ? <CameraFilters /> : null}
    </div>
  );
}

// One global-signal layer: dot + label + attribution + live count + toggle.
// Mirrors LayerRow but reads the SEPARATE signals store (default off, opt-in).
function SignalRow({ id }: { id: string }) {
  const source = SIGNALS.find((s) => s.id === id)!;
  const on = useSignals()[id] === true;
  const count = useSignalCounts()[id];
  const countLabel = count != null ? count.toLocaleString() : on ? "…" : "—";
  return (
    <div className="tn-layer-row" style={{ opacity: on ? 1 : 0.55 }}>
      <div className="tn-layer-head" style={{ cursor: "default" }}>
        <span
          className="tn-layer-dot"
          style={{ background: source.color, boxShadow: on ? `0 0 7px ${source.color}88` : "none" }}
        />
        <div className="tn-layer-main">
          <span className="tn-layer-name">{source.label}</span>
          <span className="tn-layer-source">{source.attribution}</span>
        </div>
      </div>
      <span className="tn-layer-count tn-num">{countLabel}</span>
      <Toggle
        on={on}
        accent={source.color}
        label={`Toggle ${source.label}`}
        onClick={() => signalsStore.toggle(id)}
      />
    </div>
  );
}

// Collapsible "Global signals" section. Default COLLAPSED — these are heavy,
// global, opt-in feeds, so they stay out of the way until deliberately opened.
function GlobalSignals() {
  const [open, setOpen] = useState(false);
  const groups = signalsByGroup();
  const onCount = useSignals();
  const activeCount = SIGNALS.filter((s) => onCount[s.id]).length;
  return (
    <div className="tn-signals">
      <button
        type="button"
        className="tn-signals-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="tn-signals-title">
          Global signals
          {activeCount > 0 ? <span className="tn-signals-badge">{activeCount}</span> : null}
        </span>
        <span className="tn-layer-caret" data-open={open}>
          ›
        </span>
      </button>
      {open && (
        <div className="tn-signals-body">
          {groups.map((g) => (
            <div key={g.group} className="tn-rail-section">
              <div className="tn-subhead">{g.group}</div>
              {g.sources.map((s) => (
                <SignalRow key={s.id} id={s.id} />
              ))}
            </div>
          ))}
          <p className="tn-rail-foot">
            Opt-in natural-hazard &amp; space-weather layers. Fetched only while on; every feed is
            keyless, live and attributed.
          </p>
        </div>
      )}
    </div>
  );
}

export default function LayerRail() {
  const ui = useUI();
  const m = useMetrics();

  const count = (k: LayerKey): number | null => {
    if (k === "cameras") return m.camerasTotal || null;
    if (k === "planes") return m.planes;
    if (k === "satellites") return m.satellites;
    if (k === "webcams") return m.webcams || null;
    return null;
  };

  if (!ui.railOpen) {
    return (
      <button type="button" className="tn-rail-fab" onClick={() => uiStore.setRailOpen(true)} title="Show layers">
        <span className="tn-rail-fab-bars" aria-hidden>≡</span>
        Layers
      </button>
    );
  }

  return (
    <aside className="tn-rail" aria-label="Layers">
      <div className="tn-rail-header">
        <span className="tn-rail-title">Layers</span>
        <button type="button" className="tn-rail-collapse" onClick={() => uiStore.setRailOpen(false)} aria-label="Collapse layers">
          ‹
        </button>
      </div>

      <div className="tn-presets" role="group" aria-label="Layer presets">
        {LAYER_PRESETS.map((p) => (
          <button key={p.id} type="button" className="tn-preset-btn" onClick={() => layersStore.applyPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="tn-rail-section">
        {ACTIVE_LAYERS.map((k) => (
          <LayerRow key={k} layerKey={k} count={count(k)} expandable={k === "cameras"} />
        ))}
      </div>

      <div className="tn-rail-divider" />

      <div className="tn-rail-section">
        {PLANNED_LAYERS.map((k) => (
          <LayerRow key={k} layerKey={k} count={null} />
        ))}
      </div>

      <div className="tn-rail-divider" />

      <GlobalSignals />

      <div className="tn-rail-divider" />

      <button type="button" className="tn-coverage-open" onClick={() => coverageStore.open()}>
        Coverage details — live counts per source
      </button>

      <button type="button" className="tn-coverage-open" onClick={() => marketsStore.open()}>
        Markets — live crypto prices
      </button>

      <p className="tn-rail-foot">Only layers you can see are fetched. Everything here is a real, live, attributable feed.</p>
    </aside>
  );
}
