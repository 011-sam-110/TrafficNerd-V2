"use client";
// The unified control surface (evolves LayerRail). Every source is one row with TWO
// orthogonal toggles: ◇ Map (draw on the globe — the existing layers/signals store)
// and ▦ Widget (give it a grid tile — the placement store). Search + an X/Y-enabled
// counter (map axis). This is also the "add widget" tray. One piece of state per
// (source, axis): the ◇ toggle here is the SAME state as a widget's footer ◇ toggle.

import { useMemo, useState } from "react";
import { catalogByGroup, SOURCE_CATALOG, type CatalogSource } from "@/lib/sources/catalog";
import { useSourceLive, toggleSourceMap } from "@/lib/sources/live";
import { placementStore, usePlacement } from "@/lib/widgets/placement";
import { sourceKey } from "@/lib/widgets/registry";
import { useLayers, type LayerKey } from "@/lib/layers";
import { useSignals } from "@/lib/signals/store";

function CatalogRow({ s }: { s: CatalogSource }) {
  const live = useSourceLive(s.id);
  const placed = usePlacement();
  const widgeted = placed.includes(sourceKey(s.id));
  return (
    <div className="tn-cat-row" style={{ opacity: live.mapOn || widgeted ? 1 : 0.6 }}>
      <span className="tn-cat-dot" style={{ background: s.color }} />
      <div className="tn-cat-main">
        <span className="tn-cat-name">{s.label}</span>
        <span className="tn-cat-attr">{s.attribution}</span>
      </div>
      <span className="tn-cat-count tn-num">{live.count == null ? "—" : live.count.toLocaleString()}</span>
      <button
        type="button"
        className="tn-cat-toggle"
        role="switch"
        aria-checked={live.mapOn}
        title={live.mapOn ? "On map — click to hide" : "Off map — click to show"}
        onClick={() => toggleSourceMap(s.id, !live.mapOn)}
        style={{ background: live.mapOn ? s.color : "var(--tn-toggle-off)" }}
      >◇</button>
      <button
        type="button"
        className="tn-cat-widget"
        aria-pressed={widgeted}
        title={widgeted ? "Remove widget" : "Add as a widget"}
        onClick={() => placementStore.toggle(sourceKey(s.id))}
      >{widgeted ? "▦" : "＋"}</button>
    </div>
  );
}

export default function SourceCatalog() {
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalogByGroup();
    return catalogByGroup()
      .map((g) => ({ group: g.group, sources: g.sources.filter((s) => s.label.toLowerCase().includes(needle) || s.group.toLowerCase().includes(needle)) }))
      .filter((g) => g.sources.length > 0);
  }, [q]);

  if (!open) {
    return (
      <button type="button" className="tn-rail-fab" onClick={() => setOpen(true)} title="Show sources">
        <span className="tn-rail-fab-bars" aria-hidden>≡</span> Sources
      </button>
    );
  }
  return (
    <aside className="tn-rail tn-catalog" aria-label="Source catalog">
      <div className="tn-rail-header">
        <span className="tn-rail-title">Sources</span>
        <CatalogCounter />
        <button type="button" className="tn-rail-collapse" onClick={() => setOpen(false)} aria-label="Collapse sources">‹</button>
      </div>
      <input
        className="tn-cat-search"
        type="search"
        placeholder="Search sources…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search sources"
      />
      <div className="tn-cat-body">
        {groups.map((g) => (
          <div key={g.group} className="tn-rail-section">
            <div className="tn-subhead">{g.group}</div>
            {g.sources.map((s) => <CatalogRow key={s.id} s={s} />)}
          </div>
        ))}
      </div>
      <p className="tn-rail-foot">◇ draws on the globe · ＋ adds a monitor widget. Only sources on the map are fetched (widget-driven fetch lands in a later phase).</p>
    </aside>
  );
}

// Counter reads the on/off stores DIRECTLY (one hook each, fixed order) — never a
// per-source hook in a loop.
function CatalogCounter() {
  const layers = useLayers();
  const sig = useSignals();
  const total = SOURCE_CATALOG.length;
  const on = SOURCE_CATALOG.filter((s) =>
    s.kind === "core" ? layers[s.id as LayerKey] === true : sig[s.id] === true
  ).length;
  return <span className="tn-cat-counter tn-num">{on}/{total} on</span>;
}
