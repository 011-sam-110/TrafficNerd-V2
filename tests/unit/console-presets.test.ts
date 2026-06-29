import { expect, test } from "vitest";
import { BUILTIN_PRESETS } from "@/lib/console/presets";
import { SIGNALS } from "@/lib/signals/registry";

const CORE_WIDGETS = new Set(["events", "news", "cameras", "aviation", "satellites", "markets", "headlines"]);
const SIGNAL_WIDGETS = new Set(SIGNALS.map((s) => `signal:${s.id}`));

test("built-ins are non-empty and within the cap", () => {
  const ids = BUILTIN_PRESETS.map((p) => p.id);
  expect(ids).toContain("world");
  expect(ids).toContain("aviation-ops");
  expect(ids).toContain("disaster-response");
  for (const p of BUILTIN_PRESETS) {
    const l = p.build();
    expect(l.widgets.length).toBeGreaterThan(0);
    expect(l.widgets.length).toBeLessThanOrEqual(50);
  }
});

test("aviation-ops puts an aviation widget on the canvas with a stage", () => {
  const l = BUILTIN_PRESETS.find((p) => p.id === "aviation-ops")!.build();
  expect(l.widgets.some((w) => w.type === "aviation")).toBe(true);
  expect(["map2d", "map3d", "clock"]).toContain(l.stage);
});

test("the field profiles are all present", () => {
  const ids = BUILTIN_PRESETS.map((p) => p.id);
  for (const id of ["security", "cyber-infra", "climate", "space", "markets-news", "maritime"]) {
    expect(ids).toContain(id);
  }
});

test("every preset references only real core widgets or registered signal widgets", () => {
  for (const p of BUILTIN_PRESETS) {
    for (const w of p.build().widgets) {
      const known = CORE_WIDGETS.has(w.type) || SIGNAL_WIDGETS.has(w.type);
      expect(known, `preset "${p.id}" references unknown widget type "${w.type}"`).toBe(true);
    }
  }
});
