// Pure grouping + filter for the ⌘K command palette. Deliberately import-light —
// no React, no stores — so the palette component stays thin and this logic unit-tests
// fast. CommandPalette.tsx owns the command definitions and rendering; this owns the
// shape (Command), the fixed section order, and how a query slices commands into groups.

/**
 * The palette's fixed sections, in display order. Kept fine-grained on purpose:
 * one job per section so a glance (or a filtered query) lands you in the right place.
 *   • Profiles      — apply a persona workspace (the fast path to a full board)
 *   • Go to         — fly to a place / region, or dive into a live feed
 *   • Add widget    — drop a new card onto the workspace
 *   • Open widgets  — jump focus to a card that's already open
 *   • Map layers    — toggle an individual globe layer on/off
 *   • Layer sets    — apply a curated bundle of layers
 *   • Basemap       — swap the underlying map style
 *   • Stage         — what the centre stage shows (3D / 2D / clock)
 *   • Scenarios     — switch the top-left monitor variant
 *   • Appearance    — theme + language
 *   • Workspace     — save / reset / share the current composition
 */
export type CommandGroup =
  | "Profiles"
  | "Go to"
  | "Add widget"
  | "Open widgets"
  | "Map layers"
  | "Layer sets"
  | "Basemap"
  | "Stage"
  | "Scenarios"
  | "Appearance"
  | "Workspace";

export interface Command {
  id: string;
  label: string;
  hint: string;
  group: CommandGroup;
  run: () => void;
}

export interface GroupedCommands {
  group: CommandGroup;
  commands: Command[];
}

/** Fixed display order of the palette's sections. Groups always render in this order. */
export const GROUP_ORDER: CommandGroup[] = [
  "Profiles",
  "Go to",
  "Add widget",
  "Open widgets",
  "Map layers",
  "Layer sets",
  "Basemap",
  "Stage",
  "Scenarios",
  "Appearance",
  "Workspace",
];

/**
 * Slice commands into the fixed section order, applying a case-insensitive substring
 * filter over each command's label + hint. A blank query keeps every command. Groups
 * that end up empty are dropped; the surviving groups keep GROUP_ORDER, and within a
 * group the incoming command order is preserved.
 */
export function groupCommands(commands: Command[], query: string): GroupedCommands[] {
  const q = query.trim().toLowerCase();
  const matches = (c: Command) =>
    !q || c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q);

  const out: GroupedCommands[] = [];
  for (const group of GROUP_ORDER) {
    const inGroup = commands.filter((c) => c.group === group && matches(c));
    if (inGroup.length > 0) out.push({ group, commands: inGroup });
  }
  return out;
}

/**
 * Lay the (already ordered) sections out across `columnCount` side-by-side columns
 * for the mega-menu palette — sections stay whole (never split) and keep GROUP_ORDER,
 * flowing left-to-right. Each section lands in the column its running "centre of mass"
 * falls into, then clamped so columns fill sequentially with no gaps and no backwards
 * jumps. The result reads column-major (top of col 0 → bottom, then col 1 …), which is
 * exactly the order ↑/↓ walks in the palette. Columns beyond the section count collapse
 * away, so a 2-section filter never renders 3 empty columns.
 */
export function columnize(sections: GroupedCommands[], columnCount: number): GroupedCommands[][] {
  if (sections.length === 0) return [];
  const n = Math.max(1, Math.min(columnCount, sections.length));
  const cols: GroupedCommands[][] = Array.from({ length: n }, () => []);
  const total = sections.reduce((s, g) => s + g.commands.length, 0);
  const target = total / n; // items per column, on average
  let col = 0;
  let colWeight = 0;
  for (let i = 0; i < sections.length; i++) {
    const remaining = sections.length - i; // sections still to place, incl. this one
    if (col < n - 1 && colWeight > 0) {
      const emptyAfter = n - 1 - col; // columns after the current one still needing content
      // Forced: keeping this section here would strand a trailing column empty.
      const forced = remaining - 1 < emptyAfter;
      // Balanced: current column has met its share and advancing won't strand columns.
      const balanced = colWeight >= target && remaining - 1 >= emptyAfter;
      if (forced || balanced) { col += 1; colWeight = 0; }
    }
    cols[col].push(sections[i]);
    colWeight += sections[i].commands.length;
  }
  return cols;
}
