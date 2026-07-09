import { expect, test } from "vitest";
import { groupCommands, GROUP_ORDER, type Command } from "@/lib/console/paletteGroups";

const cmd = (id: string, label: string, hint: string, group: Command["group"]): Command =>
  ({ id, label, hint, group, run: () => {} });

// One command per group, deliberately pushed OUT of display order so the tests
// prove groupCommands re-orders into GROUP_ORDER rather than echoing input order.
const sample: Command[] = [
  cmd("work-1", "Copy shareable link", "share", "Workspace"),
  cmd("appear-1", "Toggle light / dark theme", "theme", "Appearance"),
  cmd("scen-1", "Middle East", "scenario", "Scenarios"),
  cmd("stage-1", "Stage → 2D map", "stage", "Stage"),
  cmd("base-1", "Satellite", "basemap", "Basemap"),
  cmd("set-1", "Everything", "layer set", "Layer sets"),
  cmd("map-1", "Toggle Cameras", "layer", "Map layers"),
  cmd("open-1", "Focus Aviation", "widget", "Open widgets"),
  cmd("add-1", "Add Aviation", "aviation", "Add widget"),
  cmd("go-1", "Fly to Kyiv", "region", "Go to"),
  cmd("go-2", "Dive to a live feed", "live", "Go to"),
  cmd("prof-1", "🔎 Intelligence", "for analysts", "Profiles"),
];

test("blank query keeps every command, groups render in the fixed order", () => {
  const g = groupCommands(sample, "");
  expect(g.map((x) => x.group)).toEqual([
    "Profiles", "Go to", "Add widget", "Open widgets", "Map layers",
    "Layer sets", "Basemap", "Stage", "Scenarios", "Appearance", "Workspace",
  ]);
  expect(g.flatMap((x) => x.commands)).toHaveLength(sample.length);
});

test("fixed order is independent of input order", () => {
  const shuffled = [...sample].reverse();
  const g = groupCommands(shuffled, "");
  expect(g.map((x) => x.group)).toEqual(GROUP_ORDER);
});

test("within a group, incoming command order is preserved", () => {
  const g = groupCommands(sample, "");
  const go = g.find((x) => x.group === "Go to")!;
  expect(go.commands.map((c) => c.id)).toEqual(["go-1", "go-2"]);
});

test("filter matches the label (case-insensitive) and drops empty groups", () => {
  const g = groupCommands(sample, "FLY");
  expect(g.map((x) => x.group)).toEqual(["Go to"]);
  expect(g[0].commands.map((c) => c.id)).toEqual(["go-1"]);
});

test("filter matches the hint too", () => {
  const g = groupCommands(sample, "theme");
  expect(g.map((x) => x.group)).toEqual(["Appearance"]);
  expect(g[0].commands.map((c) => c.id)).toEqual(["appear-1"]);
});

test("filter matches the hint case-insensitively", () => {
  const g = groupCommands(sample, "Analysts");
  expect(g.map((x) => x.group)).toEqual(["Profiles"]);
});

test("a query that matches nothing yields an empty array", () => {
  expect(groupCommands(sample, "zzz-no-match")).toEqual([]);
});

test("partial matches across groups keep only the non-empty groups, in order", () => {
  const cmds: Command[] = [
    cmd("a", "🌐 World Overview", "generalist", "Profiles"),
    cmd("b", "Fly to Worthing", "region", "Go to"),
    cmd("c", "Everything (world)", "layer set", "Layer sets"),
  ];
  const g = groupCommands(cmds, "wor");
  // "wor" hits World (Profiles) + Worthing (Go to) + world (Layer sets), in GROUP_ORDER.
  expect(g.map((x) => x.group)).toEqual(["Profiles", "Go to", "Layer sets"]);
});
