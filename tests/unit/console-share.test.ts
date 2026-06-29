import { expect, test } from "vitest";
import { encodeLayout, decodeLayout } from "@/lib/console/share";
import { BUILTIN_PRESETS } from "@/lib/console/presets";
import { createDefaultLayout, type ShellLayout } from "@/lib/console/types";

test("encode→decode round-trips a layout", () => {
  const l = BUILTIN_PRESETS.find((p) => p.id === "disaster-response")!.build();
  const round = decodeLayout(encodeLayout(l));
  expect(round?.stage).toBe(l.stage);
  expect(round?.widgets.map((w) => w.type)).toEqual(l.widgets.map((w) => w.type));
});

test("decode returns null on garbage", () => {
  expect(decodeLayout("@@@notjson@@@")).toBeNull();
});

test("decode backfills missing segments through sanitize", () => {
  const partial = { segments: { left: { size: 320, collapsed: false } }, stage: "map2d", widgets: [] };
  const round = decodeLayout(encodeLayout(partial as unknown as ShellLayout));
  expect(round).not.toBeNull();
  expect(round!.segments.right).toBeDefined();
  expect(round!.segments.bottom).toBeDefined();
  expect(typeof round!.segments.right.size).toBe("number");
});

test("decode caps an oversized layout at 50 widgets", () => {
  const widgets = Array.from({ length: 60 }, (_, i) => ({
    id: `w${i}`, type: "clock", segment: "left", order: i, height: 240, collapsed: false, config: {},
  }));
  const layout = { segments: createDefaultLayout().segments, stage: "map2d", widgets };
  const round = decodeLayout(encodeLayout(layout as unknown as ShellLayout));
  expect(round!.widgets.length).toBe(50);
});
