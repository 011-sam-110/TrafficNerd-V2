import { expect, test } from "vitest";
import { BUILTIN_PRESETS, DEFAULT_PRESET_ID } from "@/lib/console/presets";
import { SIGNALS } from "@/lib/signals/registry";

const CORE_WIDGETS = new Set(["events", "news", "cameras", "aviation", "satellites", "markets", "headlines", "locate"]);
const SIGNAL_WIDGETS = new Set(SIGNALS.map((s) => `signal:${s.id}`));

// The persona lineup: one preset per major user type. Ids are stable (used by the
// first-run seed, the ⌘K Profiles section, and shared layout URLs).
const PERSONA_IDS = [
  "world", "newsroom", "intelligence", "emergency", "aviation-ops",
  "markets-desk", "space", "maritime", "climate", "cyber-infra", "explorer",
];

test("the full persona lineup is present, non-empty, and within the cap", () => {
  const ids = BUILTIN_PRESETS.map((p) => p.id);
  for (const id of PERSONA_IDS) expect(ids).toContain(id);
  for (const p of BUILTIN_PRESETS) {
    const l = p.build();
    expect(l.widgets.length).toBeGreaterThan(0);
    expect(l.widgets.length).toBeLessThanOrEqual(50);
  }
});

test("the default landing preset exists and seeds a real board", () => {
  const def = BUILTIN_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID);
  expect(def, `DEFAULT_PRESET_ID "${DEFAULT_PRESET_ID}" must be a built-in`).toBeDefined();
  expect(def!.build().widgets.length).toBeGreaterThan(0);
});

test("every preset carries a persona blurb (who it's for)", () => {
  for (const p of BUILTIN_PRESETS) {
    expect(p.blurb.length, `preset "${p.id}" needs a blurb`).toBeGreaterThan(0);
  }
});

test("aviation-ops puts an aviation widget on the canvas with a stage", () => {
  const l = BUILTIN_PRESETS.find((p) => p.id === "aviation-ops")!.build();
  expect(l.widgets.some((w) => w.type === "aviation")).toBe(true);
  expect(["map2d", "map3d", "clock"]).toContain(l.stage);
});

test("every preset references only real core widgets or registered signal widgets", () => {
  for (const p of BUILTIN_PRESETS) {
    for (const w of p.build().widgets) {
      const known = CORE_WIDGETS.has(w.type) || SIGNAL_WIDGETS.has(w.type);
      expect(known, `preset "${p.id}" references unknown widget type "${w.type}"`).toBe(true);
    }
  }
});
