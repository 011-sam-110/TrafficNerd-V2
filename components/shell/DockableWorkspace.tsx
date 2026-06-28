"use client";
// The opt-in dockable workspace (SP1b). Renders the active variant's visible
// DOCKABLE panels as react-grid-layout tiles, using the RGL 2.x SSR-safe pattern
// (useContainerWidth + `mounted` gate → server/first-paint render an empty
// container, so hydration matches). Static while reading; draggable-by-header +
// resizable while editing. onLayoutChange feeds the draft buffer (read fresh from
// the store to dodge stale closures); WorkspaceBar commits it. See
// docs/superpowers/research/2026-06-27-sp1b-rgl-spike.md for the API rationale.
//
// Tiles resolve in two ways: a registered PanelKey renders its PANEL_REGISTRY
// component; a dynamic widget key (`source:<id>` / `rollup:<group>`, added by the
// Source Catalog) renders a docked <SourceWidget>. This is the seam that lets
// "widgetize everything" share one grid with the intel panels.
import type { ComponentType } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useVariant, variantStore } from "@/lib/variants/store";
import { useWorkspace, workspaceStore } from "@/lib/shell/workspace";
import { placementsToRglItems, rglItemsToPlacements, type RglItem } from "@/lib/variants/layout";
import { PANEL_REGISTRY } from "@/lib/shell/panelRegistry";
import { widgetForKey } from "@/lib/widgets/registry";
import PanelTile from "@/components/shell/PanelTile";
import SourceWidget from "@/components/shell/SourceWidget";
import type { PanelPlacement } from "@/lib/variants/types";

// Registered panels that belong in the dock (the intelligence/markets panels). The
// persistent chrome — layerRail, freshness AND news — stays as calm SP1a chrome
// rendered by PanelHost, never docked (docking `news` would double-mount the ticker).
const DOCKABLE = new Set<string>([
  "markets", "brief", "watchlist", "coverage",
  "instability", "conflict", "topEvents", "risk",
]);

/** A placement is dockable if it is a known dock panel OR a dynamic widget key. */
function isDockable(key: string): boolean {
  return DOCKABLE.has(key) || key.startsWith("source:") || key.startsWith("rollup:");
}

type RegEntry = { component: ComponentType<{ docked?: boolean }>; title: string };
const REGISTRY = PANEL_REGISTRY as Record<string, RegEntry>;

export default function DockableWorkspace() {
  const { activeId } = useVariant();
  const ws = useWorkspace();
  const { width, containerRef, mounted } = useContainerWidth();

  if (!ws.open) return null;

  const source = ws.editing && ws.draft ? ws.draft : variantStore.layoutForVariant(activeId);
  const placements: PanelPlacement[] = source.filter((p) => p.visible && isDockable(p.panel));
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
                (l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }),
              );
              workspaceStore.updateDraft(rglItemsToPlacements(next, st.draft ?? placements));
            }}
          >
            {placements.map((p) => {
              const reg = REGISTRY[p.panel];
              const widget = reg ? null : widgetForKey(p.panel);
              const title = reg ? reg.title : widget?.title ?? p.panel;
              const Cmp = reg?.component;
              return (
                <div key={p.panel}>
                  <PanelTile title={title} editing={ws.editing}>
                    {Cmp ? <Cmp docked /> : widget ? <SourceWidget widget={widget} docked /> : null}
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
