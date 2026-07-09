// lib/events/opsConfig.ts
// PURE readers/coercers over the Disasters & Events widget's persisted `config`
// bag (a Record<string,unknown> the shell already persists per widget instance —
// same store markets.detail writes `selectedId` into). Keeping these pure and
// node-testable means the compact widget and the focus view read view-prefs the
// SAME way, and a stale/garbage saved value degrades to a safe default instead of
// throwing. Group 1 owns the clustering prefs (grouping mode + collapse state);
// Group 2 extends this file with the signal-to-noise filter shape.

export type GroupBy = "region" | "type" | "none";
export const GROUP_BY_VALUES: GroupBy[] = ["region", "type", "none"];
export const DEFAULT_GROUP_BY: GroupBy = "region";

/** Grouping mode from config, defaulting to region; junk → default. */
export function readGroupBy(config: Record<string, unknown>): GroupBy {
  const v = config.evGroupBy;
  return GROUP_BY_VALUES.includes(v as GroupBy) ? (v as GroupBy) : DEFAULT_GROUP_BY;
}

/** Persisted collapse map (groupKey → collapsed) from config; junk → {}. */
export function readCollapsed(config: Record<string, unknown>): Record<string, boolean> {
  const v = config.evCollapsed;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
}

/** Namespaced collapse key so a region id and a type id never collide. */
export function collapseKey(mode: GroupBy, key: string): string {
  return `${mode}:${key}`;
}

/** Is this group collapsed? (Absent = expanded.) */
export function isCollapsed(collapsed: Record<string, boolean>, mode: GroupBy, key: string): boolean {
  return collapsed[collapseKey(mode, key)] === true;
}

/** Pure toggle: return the next collapse map with (mode,key) flipped. */
export function toggleCollapsed(
  collapsed: Record<string, boolean>,
  mode: GroupBy,
  key: string,
): Record<string, boolean> {
  const ck = collapseKey(mode, key);
  return { ...collapsed, [ck]: !(collapsed[ck] === true) };
}
