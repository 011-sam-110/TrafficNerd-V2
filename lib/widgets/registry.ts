// Descriptors for the two Phase-1 data widget kinds: one roll-up per catalog group,
// and a leaf per source (born from a roll-up pop-out). Stable string keys are the
// placement + (later) layout-override identity. Utility widgets (map/video/etc.)
// are NOT defined here in Phase 1 — they keep their existing PANEL_REGISTRY entries.

import { SOURCE_CATALOG, catalogByGroup, getCatalogSource } from "@/lib/sources/catalog";

export type WidgetKind = "rollup" | "source";

export interface WidgetDescriptor {
  key: string;
  kind: WidgetKind;
  title: string;
  /** group name (rollup) or source id (source). */
  ref: string;
  defaultGrid: { w: number; h: number; minW: number; minH: number };
}

export function rollupKey(group: string): string {
  return `rollup:${group}`;
}
export function sourceKey(id: string): string {
  return `source:${id}`;
}

const ROLLUP_GRID = { w: 3, h: 3, minW: 2, minH: 2 };
const SOURCE_GRID = { w: 3, h: 2, minW: 2, minH: 2 };

export function rollupWidgets(): WidgetDescriptor[] {
  return catalogByGroup().map((g) => ({
    key: rollupKey(g.group),
    kind: "rollup" as const,
    title: g.group,
    ref: g.group,
    defaultGrid: { ...ROLLUP_GRID },
  }));
}

export function sourceWidget(id: string): WidgetDescriptor | undefined {
  const s = getCatalogSource(id);
  if (!s) return undefined;
  return { key: sourceKey(id), kind: "source", title: s.label, ref: id, defaultGrid: { ...SOURCE_GRID } };
}

export function widgetForKey(key: string): WidgetDescriptor | undefined {
  if (key.startsWith("rollup:")) {
    const group = key.slice("rollup:".length);
    return rollupWidgets().find((w) => w.ref === group);
  }
  if (key.startsWith("source:")) {
    return sourceWidget(key.slice("source:".length));
  }
  return undefined;
}
