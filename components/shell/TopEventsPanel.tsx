"use client";
// Live Now · Top Events widget — strongest hazards merged across earthquakes,
// fires, GDACS disasters and tropical cyclones, ranked by severity then recency.
// Zero-click situational awareness. Dock-only (v1). Each row → fly + dossier.

import { useSignalFeatures } from "@/lib/widgets/useSignalFeatures";
import { topEventsRows } from "@/lib/widgets/topEvents";
import { openSignalFeature } from "@/lib/widgets/openSignal";
import { useNow, formatAge } from "@/lib/shell/useNow";

export default function TopEventsPanel({ docked = false }: { docked?: boolean } = {}) {
  const quakes = useSignalFeatures("earthquakes", docked);
  const fires = useSignalFeatures("fire-active", docked);
  const disasters = useSignalFeatures("gdacs", docked);
  const cyclones = useSignalFeatures("tropical-cyclones", docked);
  const now = useNow(1000);
  if (!docked) return null;

  const rows = topEventsRows([
    { kind: "Quake", features: quakes.features },
    { kind: "Fire", features: fires.features },
    { kind: "Disaster", features: disasters.features },
    { kind: "Cyclone", features: cyclones.features },
  ]);
  const feeds = [quakes, fires, disasters, cyclones];
  const updatedAt = Math.max(0, ...feeds.map((f) => f.updatedAt ?? 0)) || null;
  const anyLoading = feeds.some((f) => f.status === "loading");
  return (
    <aside className="tn-widget tn-docked" role="region" aria-label="Top events">
      <header className="tn-widget-head">
        <h2 className="tn-widget-title">Live Now · Top Events</h2>
        <span className="tn-widget-source">hazards</span>
      </header>
      {anyLoading && rows.length === 0 && <p className="tn-widget-status">Loading…</p>}
      {!anyLoading && rows.length === 0 && <p className="tn-widget-status">No active events right now.</p>}
      <ol className="tn-widget-list">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" className="tn-widget-row" onClick={() => openSignalFeature(r.feature, r.kind)}>
              <span className="tn-widget-chip" style={{ background: r.color }}>{r.kind}</span>
              <span className="tn-widget-row-main">
                <span className="tn-widget-row-title">{r.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {updatedAt != null && (
        <p className="tn-widget-foot">Updated {formatAge(now - updatedAt)} ago · USGS · FIRMS · GDACS · NOAA</p>
      )}
    </aside>
  );
}
