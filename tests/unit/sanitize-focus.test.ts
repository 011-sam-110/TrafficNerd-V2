// tests/unit/sanitize-focus.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeLayout } from "@/lib/console/sanitize";

const base = {
  segments: { left: { size: 320, collapsed: false }, right: { size: 320, collapsed: false }, bottom: { size: 240, collapsed: false } },
  stage: "map2d",
  widgets: [{ id: "w1", type: "events", segment: "left", order: 0, width: 12, height: 240, collapsed: false, config: {} }],
};

describe("sanitizeLayout focus", () => {
  it("keeps a focusedWidgetId that matches a widget", () => {
    const out = sanitizeLayout({ ...base, focusedWidgetId: "w1" });
    expect(out?.focusedWidgetId).toBe("w1");
  });
  it("drops a focusedWidgetId with no matching widget", () => {
    const out = sanitizeLayout({ ...base, focusedWidgetId: "ghost" });
    expect(out?.focusedWidgetId).toBeNull();
  });
  it("defaults missing/invalid focus to null", () => {
    expect(sanitizeLayout({ ...base })?.focusedWidgetId).toBeNull();
    expect(sanitizeLayout({ ...base, focusedWidgetId: 42 })?.focusedWidgetId).toBeNull();
  });
});
