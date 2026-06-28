import { expect, test } from "vitest";
import { createDefaultLayout, MAX_WIDGETS } from "@/lib/console/types";

test("default layout has three segments, a 2D stage, and no widgets", () => {
  const l = createDefaultLayout();
  expect(Object.keys(l.segments).sort()).toEqual(["bottom", "left", "right"]);
  expect(l.segments.left).toEqual({ size: 320, collapsed: false });
  expect(l.segments.bottom).toEqual({ size: 240, collapsed: false });
  expect(l.stage).toBe("map2d");
  expect(l.widgets).toEqual([]);
  expect(MAX_WIDGETS).toBe(50);
});
