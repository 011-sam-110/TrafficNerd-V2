import { expect, test } from "vitest";
import { layersForLayout } from "@/lib/console/presetLayers";
import { BUILTIN_PRESETS } from "@/lib/console/presets";
import { createDefaultLayout } from "@/lib/console/types";
import { addWidget } from "@/lib/console/reducers";

function buildById(id: string) {
  const p = BUILTIN_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p.build();
}

// signal ids that are ON, and core layer keys that are ON (excluding the always-on
// `countries` base layer, which is geography, not a data layer).
function onLayers(layout: ReturnType<typeof createDefaultLayout>) {
  const { core, signals } = layersForLayout(layout);
  const onSignals = Object.entries(signals).filter(([, v]) => v).map(([k]) => k).sort();
  const onCore = Object.entries(core)
    .filter(([k, v]) => v && k !== "countries")
    .map(([k]) => k)
    .sort();
  return { core, signals, onSignals, onCore };
}

test("Situation Room board → conflict/intel signals ON, all core layers OFF", () => {
  const { onSignals, onCore, core } = onLayers(buildById("situation"));
  expect(onSignals).toEqual(["acled", "conflict", "displacement", "instability", "military-air", "protests"]);
  expect(onCore).toEqual([]); // no planes/cameras/satellites on an analyst board
  expect(core.countries).toBe(true); // base geography is never stripped
});

test("Air·Sea·Space board → planes+satellites core layers ON plus its signal layers", () => {
  const { onSignals, onCore } = onLayers(buildById("mobility"));
  expect(onCore).toEqual(["planes", "satellites"]); // aviation widget → planes, satellites widget → satellites
  expect(onSignals).toEqual(["ais", "aurora", "cables", "launches", "ports"]);
});

test("list-only widgets (events/markets/headlines) imply no map layer", () => {
  // World Overview mixes a cameras widget + list widgets: only cameras should light up.
  const { onCore, onSignals } = onLayers(buildById("overview"));
  expect(onCore).toEqual(["cameras"]);
  expect(onSignals).toEqual(["instability"]);

  // A board of pure list widgets lights up nothing.
  let l = createDefaultLayout();
  l = addWidget(l, "events", "a", { segment: "left" });
  l = addWidget(l, "markets", "b", { segment: "right" });
  l = addWidget(l, "headlines", "c", { segment: "bottom" });
  const empty = onLayers(l);
  expect(empty.onCore).toEqual([]);
  expect(empty.onSignals).toEqual([]);
});

test("every built-in persona lights up at least one data layer (no blank-map board)", () => {
  for (const p of BUILTIN_PRESETS) {
    const { onCore, onSignals } = onLayers(p.build());
    expect(
      onCore.length + onSignals.length,
      `persona "${p.id}" must switch on at least one map layer`,
    ).toBeGreaterThan(0);
  }
});
