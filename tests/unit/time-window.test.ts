import { expect, test } from "vitest";
import { withinWindow, windowMsFor, TIME_WINDOWS, DEFAULT_TIME_WINDOW } from "@/lib/shell/timeWindow";

const NOW = Date.parse("2026-06-27T12:00:00Z");
const HOUR = 3600_000;

test("All window keeps everything (no filtering)", () => {
  expect(withinWindow("1990-01-01T00:00:00Z", null, NOW)).toBe(true);
  expect(windowMsFor("all")).toBeNull();
});

test("untimed features are ALWAYS shown (never hide what we can't date)", () => {
  expect(withinWindow(null, HOUR, NOW)).toBe(true);
  expect(withinWindow(undefined, HOUR, NOW)).toBe(true);
  expect(withinWindow("not-a-date", HOUR, NOW)).toBe(true);
});

test("a recent event is within a 1h window; an old one is not", () => {
  expect(withinWindow(new Date(NOW - 30 * 60_000).toISOString(), HOUR, NOW)).toBe(true);
  expect(withinWindow(new Date(NOW - 2 * HOUR).toISOString(), HOUR, NOW)).toBe(false);
});

test("the boundary is inclusive", () => {
  expect(withinWindow(NOW - HOUR, HOUR, NOW)).toBe(true);
  expect(withinWindow(NOW - HOUR - 1, HOUR, NOW)).toBe(false);
});

test("future-dated events (upcoming launches) are always shown", () => {
  expect(withinWindow(NOW + 5 * 24 * HOUR, HOUR, NOW)).toBe(true);
});

test("accepts epoch-number timestamps too", () => {
  expect(withinWindow(NOW - 10 * 60_000, HOUR, NOW)).toBe(true);
});

test("the options are well-formed and ordered, default is All", () => {
  expect(TIME_WINDOWS.map((w) => w.key)).toEqual(["1h", "6h", "24h", "7d", "all"]);
  expect(windowMsFor("6h")).toBe(6 * HOUR);
  expect(windowMsFor("7d")).toBe(7 * 24 * HOUR);
  expect(DEFAULT_TIME_WINDOW).toBe("all");
});
