import { expect, test } from "vitest";
import { groupCommands, GROUP_ORDER, type Command } from "@/lib/console/paletteGroups";

const cmd = (id: string, label: string, hint: string, group: Command["group"]): Command =>
  ({ id, label, hint, group, run: () => {} });

// One command per group, deliberately pushed OUT of display order so the tests
// prove groupCommands re-orders into GROUP_ORDER rather than echoing input order.
const sample: Command[] = [
  cmd("share-1", "Copy shareable link", "share", "Share"),
  cmd("nav-1", "Fly to Kyiv", "jump", "Navigate"),
  cmd("nav-2", "Dive to a live feed", "live", "Navigate"),
  cmd("layer-1", "Toggle Cameras", "layer", "Layers"),
  cmd("view-1", "Toggle light / dark theme", "theme", "Views"),
  cmd("widget-1", "Add Aviation", "aviation", "Widgets"),
  cmd("layout-1", "Save layout as preset…", "layout", "Layouts"),
];

test("blank query keeps every command, groups render in the fixed order", () => {
  const g = groupCommands(sample, "");
  expect(g.map((x) => x.group)).toEqual(["Navigate", "Layers", "Views", "Widgets", "Layouts", "Share"]);
  expect(g.flatMap((x) => x.commands)).toHaveLength(sample.length);
});

test("fixed order is independent of input order", () => {
  const shuffled = [...sample].reverse();
  const g = groupCommands(shuffled, "");
  expect(g.map((x) => x.group)).toEqual(GROUP_ORDER);
});

test("within a group, incoming command order is preserved", () => {
  const g = groupCommands(sample, "");
  const nav = g.find((x) => x.group === "Navigate")!;
  expect(nav.commands.map((c) => c.id)).toEqual(["nav-1", "nav-2"]);
});

test("filter matches the label (case-insensitive) and drops empty groups", () => {
  const g = groupCommands(sample, "FLY");
  expect(g.map((x) => x.group)).toEqual(["Navigate"]);
  expect(g[0].commands.map((c) => c.id)).toEqual(["nav-1"]);
});

test("filter matches the hint too", () => {
  const g = groupCommands(sample, "theme");
  expect(g.map((x) => x.group)).toEqual(["Views"]);
  expect(g[0].commands.map((c) => c.id)).toEqual(["view-1"]);
});

test("filter matches the hint case-insensitively", () => {
  const g = groupCommands(sample, "Share");
  expect(g.map((x) => x.group)).toEqual(["Share"]);
});

test("a query that matches nothing yields an empty array", () => {
  expect(groupCommands(sample, "zzz-no-match")).toEqual([]);
});

test("partial matches across groups keep only the non-empty groups, in order", () => {
  const cmds: Command[] = [
    cmd("a", "Preset: World", "preset", "Layers"),
    cmd("b", "Layout: World", "layout", "Layouts"),
    cmd("c", "Fly to Worthing", "jump", "Navigate"),
  ];
  const g = groupCommands(cmds, "wor");
  // "wor" hits Worthing (Navigate) + World (Layers, Layouts); Views/Widgets/Share drop out.
  expect(g.map((x) => x.group)).toEqual(["Navigate", "Layers", "Layouts"]);
});
