"use client";
// The opt-in dockable workspace (SP1b). Renders the active variant's visible
// DOCKABLE panels as react-grid-layout tiles, using the RGL 2.x SSR-safe pattern
// (useContainerWidth + `mounted` gate → server/first-paint render an empty
// container, so hydration matches). Static while reading; draggable-by-header +
// resizable while editing. onLayoutChange feeds the draft buffer (read fresh from
// the store to dodge stale closures); WorkspaceBar commits it. See
// docs/superpowers/research/2026-06-27-sp1b-rgl-spike.md for the API rationale.
import type { ComponentType } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useVariant, variantStore } from "@/lib/variants/store";
import { useWorkspace, workspaceStore } from "@/lib/shell/workspace";
import { placementsToRglItems, rglItemsToPlacements, type RglItem } from "@/lib/variants/layout";
import { PANEL_REGISTRY } from "@/lib/shell/panelRegistry";
import PanelTile from "@/components/shell/PanelTile";
import type { PanelKey, PanelPlacement } from "@/lib/variants/types";

// Panels that belong in the dock (intelligence + markets). The persistent chrome
// (layerRail, freshness) stays as calm SP1a chrome and is never docked.
const DOCKABLE = new Set<PanelKey>(["markets", "brief", "watchlist", "coverage", "news"]);

export default function DockableWorkspace() {
  const { activeId } = useVariant();
  const ws = useWorkspace();
  const { width, containerRef, mounted } = useContainerWidth();

  if (!ws.open) return null;

  const source = ws.editing && ws.draft ? ws.draft : variantStore.layoutForVariant(activeId);
  const placements: PanelPlacement[] = source.filter((p) => p.visible && DOCKABLE.has(p.panel));
  const items: RglItem[] = placementsToRglItems(placements);

  return (
    <div className="tn-workspace" ref={containerRef}>
      <div className="tn-workspace-inner">
        {mounted && items.length > 0 ? (
          <ResponsiveGridLayout
            width={width}
            layouts={{ lg: items }}
            breakpoints={{ lg: 0 }}
            cols={{ lg: 12 }}
            rowHeight={44}
            margin={[10, 10]}
            dragConfig={{ enabled: ws.editing, handle: ".tn-tile-drag" }}
            resizeConfig={{ enabled: ws.editing }}
            onLayoutChange={(layout) => {
              const st = workspaceStore.get();
              if (!st.editing) return;
              const next: RglItem[] = (layout as Array<{ i: string; x: number; y: number; w: number; h: number }>).map(
                (l) => ({ i: l.i as PanelKey, x: l.x, y: l.y, w: l.w, h: l.h }),
              );
              workspaceStore.updateDraft(rglItemsToPlacements(next, st.draft ?? placements));
            }}
          >
            {placements.map((p) => {
              const Cmp = PANEL_REGISTRY[p.panel].component as ComponentType<{ docked?: boolean }>;
              return (
                <div key={p.panel}>
                  <PanelTile title={PANEL_REGISTRY[p.panel].title} editing={ws.editing}>
                    <Cmp docked />
                  </PanelTile>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        ) : mounted ? (
          <p className="tn-workspace-empty">This monitor has no dockable panels.</p>
        ) : null}
      </div>
    </div>
  );
}
