"use client";
// Bridge between a source/rollup widget key and the EXISTING SP1b workspace dock.
// A source widget is "docked" iff it is a visible placement in the active variant's
// layout — so we reuse variantStore.layoutForVariant / commitLayout (the persisted
// `layoutOverrides` slot) rather than a second placement store. Adding a tile stacks
// it full-width below the lowest existing tile and opens the dock; removing drops it.

import { variantStore } from "@/lib/variants/store";
import { workspaceStore } from "@/lib/shell/workspace";
import { widgetForKey } from "@/lib/widgets/registry";
import type { PanelPlacement } from "@/lib/variants/types";

/** Is this widget key a visible tile in the active variant's dock layout? */
export function isTileDocked(activeId: string, key: string): boolean {
  return variantStore.layoutForVariant(activeId).some((p) => p.panel === key && p.visible);
}

/** Add a source/rollup widget tile to the active variant's layout + open the dock. */
export function addTileToDock(activeId: string, key: string): void {
  const cur = variantStore.layoutForVariant(activeId);
  if (cur.some((p) => p.panel === key && p.visible)) {
    workspaceStore.openWorkspace();
    return;
  }
  const w = widgetForKey(key);
  const h = w?.kind === "rollup" ? 6 : 4;
  const bottom = cur.reduce((m, p) => Math.max(m, p.grid.y + p.grid.h), 0);
  const next: PanelPlacement[] = [
    ...cur.filter((p) => p.panel !== key),
    { panel: key, grid: { x: 0, y: bottom, w: 12, h, minW: 3, minH: 3 }, visible: true },
  ];
  variantStore.commitLayout(activeId, next);
  workspaceStore.openWorkspace();
}

/** Remove a source/rollup widget tile from the active variant's layout. */
export function removeTileFromDock(activeId: string, key: string): void {
  const cur = variantStore.layoutForVariant(activeId);
  if (!cur.some((p) => p.panel === key)) return;
  variantStore.commitLayout(activeId, cur.filter((p) => p.panel !== key));
}

/** Toggle a widget tile in/out of the active variant's dock. */
export function toggleTileDock(activeId: string, key: string): void {
  if (isTileDocked(activeId, key)) removeTileFromDock(activeId, key);
  else addTileToDock(activeId, key);
}
