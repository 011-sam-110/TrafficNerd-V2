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
