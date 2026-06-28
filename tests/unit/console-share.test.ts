import { expect, test } from "vitest";
import { encodeLayout, decodeLayout } from "@/lib/console/share";
import { BUILTIN_PRESETS } from "@/lib/console/presets";

test("encode→decode round-trips a layout", () => {
  const l = BUILTIN_PRESETS.find((p) => p.id === "disaster-response")!.build();
  const round = decodeLayout(encodeLayout(l));
  expect(round?.stage).toBe(l.stage);
  expect(round?.widgets.map((w) => w.type)).toEqual(l.widgets.map((w) => w.type));
});

test("decode returns null on garbage", () => {
  expect(decodeLayout("@@@notjson@@@")).toBeNull();
});
