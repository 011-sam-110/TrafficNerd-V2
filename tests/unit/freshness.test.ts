import { expect, test } from "vitest";
import { classifyFreshness, freshnessAgeMs, type SourceRecord } from "@/lib/freshness";

const base: SourceRecord = {
  id: "planes",
  label: "Planes",
  count: 10,
  ok: true,
  lastUpdate: null,
  refreshMs: 12_000,
  local: false,
};

const NOW = 1_000_000;

test("a failed update is always down, regardless of age", () => {
  expect(classifyFreshness({ ...base, ok: false, lastUpdate: NOW }, NOW)).toBe("down");
});

test("a local source is always live (propagated in-browser, never fetched)", () => {
  expect(classifyFreshness({ ...base, local: true, lastUpdate: null }, NOW)).toBe("live");
});

test("no successful update yet reads as unknown", () => {
  expect(classifyFreshness({ ...base, lastUpdate: null }, NOW)).toBe("unknown");
});

test("age thresholds: live < 2x, lagging < 6x, stale beyond", () => {
  const at = (mult: number) => classifyFreshness({ ...base, lastUpdate: NOW - base.refreshMs * mult }, NOW);
  expect(at(1)).toBe("live");
  expect(at(3)).toBe("lagging");
  expect(at(10)).toBe("stale");
});

test("freshnessAgeMs is null before first update and never negative", () => {
  expect(freshnessAgeMs({ ...base, lastUpdate: null }, NOW)).toBeNull();
  expect(freshnessAgeMs({ ...base, lastUpdate: NOW + 5_000 }, NOW)).toBe(0);
  expect(freshnessAgeMs({ ...base, lastUpdate: NOW - 5_000 }, NOW)).toBe(5_000);
});
