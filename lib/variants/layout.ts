// Pure mappers between SP1a PanelPlacement[] and react-grid-layout geometry.
// No RGL import — RglItem mirrors RGL's Layout item shape so this stays
// dependency-light and node-testable. SP1b's DockableWorkspace feeds these to
// ResponsiveGridLayout and folds onLayoutChange results back into placements.
import type { PanelKey, PanelPlacement } from "@/lib/variants/types";

export type RglItem = {
  i: PanelKey;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

/** Visible placements → RGL layout items (hidden panels are dropped from the grid). */
export function placementsToRglItems(placements: PanelPlacement[]): RglItem[] {
  return placements
    .filter((p) => p.visible)
    .map((p) => {
      const it: RglItem = { i: p.panel, x: p.grid.x, y: p.grid.y, w: p.grid.w, h: p.grid.h };
      if (p.grid.minW != null) it.minW = p.grid.minW;
      if (p.grid.minH != null) it.minH = p.grid.minH;
      return it;
    });
}

/**
 * Fold an RGL layout back into placements: update x/y/w/h on the matching panel,
 * preserve `visible` and every other field, and leave panels absent from `items`
 * (e.g. hidden ones, or non-dockable panels) exactly as they were.
 */
export function rglItemsToPlacements(items: RglItem[], prev: PanelPlacement[]): PanelPlacement[] {
  const byId = new Map(items.map((it) => [it.i, it]));
  return prev.map((p) => {
    const it = byId.get(p.panel);
    if (!it) return p;
    return { ...p, grid: { ...p.grid, x: it.x, y: it.y, w: it.w, h: it.h } };
  });
}
