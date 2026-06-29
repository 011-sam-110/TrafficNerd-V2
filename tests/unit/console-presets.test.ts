import { expect, test } from "vitest";
import { BUILTIN_PRESETS } from "@/lib/console/presets";

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
