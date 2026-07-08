import { expect, test } from "vitest";
import { clampSpan, spanFromPointer, dropIndex, WIDGET_COLS, MIN_WIDGET_SPAN } from "@/lib/console/resize";

test("clampSpan rounds and clamps into [MIN_WIDGET_SPAN, 12]", () => {
  expect(clampSpan(6.4)).toBe(6);
  expect(clampSpan(6.6)).toBe(7);
  expect(clampSpan(0)).toBe(MIN_WIDGET_SPAN);
  expect(clampSpan(99)).toBe(WIDGET_COLS);
  expect(clampSpan(NaN)).toBe(WIDGET_COLS);
});

test("spanFromPointer snaps a right-edge drag to a column span", () => {
  expect(spanFromPointer({ pointerX: 600, slotLeft: 0, segWidth: 1200 })).toBe(6);  // half
  expect(spanFromPointer({ pointerX: 1200, slotLeft: 0, segWidth: 1200 })).toBe(12); // full
  expect(spanFromPointer({ pointerX: 40, slotLeft: 0, segWidth: 1200 })).toBe(MIN_WIDGET_SPAN); // tiny → min
  expect(spanFromPointer({ pointerX: 100, slotLeft: 0, segWidth: 0 })).toBe(12); // zero-width guard
});

test("dropIndex returns reading-order insertion index over a wrap grid", () => {
  const A = { top: 0, bottom: 100, left: 0, right: 100 };
  const B = { top: 0, bottom: 100, left: 108, right: 208 };
  const C = { top: 108, bottom: 208, left: 0, right: 100 };
  const rects = [A, B, C];
  expect(dropIndex({ x: 10, y: 50 }, rects)).toBe(0);   // left of A center → before A
  expect(dropIndex({ x: 130, y: 50 }, rects)).toBe(1);  // between A and B centers → before B
  expect(dropIndex({ x: 300, y: 50 }, rects)).toBe(2);  // right of B (end of row 1) → before C
  expect(dropIndex({ x: 10, y: 300 }, rects)).toBe(3);  // below all → append
});
