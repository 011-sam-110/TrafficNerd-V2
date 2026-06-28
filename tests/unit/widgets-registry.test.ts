import { expect, test } from "vitest";
import { rollupWidgets, sourceWidget, widgetForKey, rollupKey, sourceKey } from "@/lib/widgets/registry";
import { catalogByGroup } from "@/lib/sources/catalog";

test("one roll-up widget per catalog group, stable keys", () => {
  const groups = catalogByGroup();
  const rollups = rollupWidgets();
  expect(rollups.length).toBe(groups.length);
  expect(rollups.every((w) => w.kind === "rollup")).toBe(true);
  expect(rollups[0].key).toBe(rollupKey(groups[0].group));
});

test("sourceWidget builds a leaf descriptor for a known id, undefined otherwise", () => {
  const w = sourceWidget("cameras");
  expect(w?.kind).toBe("source");
  expect(w?.key).toBe(sourceKey("cameras"));
  expect(w?.title).toBe("Cameras");
  expect(sourceWidget("nope")).toBeUndefined();
});

test("widgetForKey resolves both kinds and enforces min sizes", () => {
  const groups = catalogByGroup();
  const r = widgetForKey(rollupKey(groups[0].group));
  expect(r?.kind).toBe("rollup");
  const s = widgetForKey(sourceKey("planes"));
  expect(s?.kind).toBe("source");
  expect(s!.defaultGrid.minW).toBeGreaterThan(0);
  expect(s!.defaultGrid.minH).toBeGreaterThan(0);
  expect(widgetForKey("bogus:x")).toBeUndefined();
});
