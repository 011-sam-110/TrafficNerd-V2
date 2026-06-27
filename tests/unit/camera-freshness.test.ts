import { expect, test } from "vitest";
import {
  msUntilRefresh,
  refreshProgress,
  formatCountdown,
  sampledAgeMs,
} from "@/lib/cameras/freshness";

const LOADED = 1_000_000;

test("msUntilRefresh counts down within the period and wraps each cycle", () => {
  expect(msUntilRefresh(LOADED, 30, LOADED)).toBe(30_000); // full period at the boundary
  expect(msUntilRefresh(LOADED, 30, LOADED + 1_000)).toBe(29_000);
  expect(msUntilRefresh(LOADED, 30, LOADED + 29_000)).toBe(1_000);
  expect(msUntilRefresh(LOADED, 30, LOADED + 30_000)).toBe(30_000); // wrapped to next cycle
  expect(msUntilRefresh(LOADED, 30, LOADED + 31_000)).toBe(29_000);
});

test("msUntilRefresh treats a future loadedAt (clock skew) as a full period", () => {
  expect(msUntilRefresh(LOADED, 30, LOADED - 5_000)).toBe(30_000);
});

test("refreshProgress is the elapsed fraction of the cycle, clamped to [0,1]", () => {
  expect(refreshProgress(LOADED, 30, LOADED)).toBe(0);
  expect(refreshProgress(LOADED, 30, LOADED + 15_000)).toBeCloseTo(0.5, 5);
  expect(refreshProgress(LOADED, 30, LOADED + 29_999)).toBeGreaterThan(0.99);
});

test("formatCountdown rounds up to whole seconds and never goes negative", () => {
  expect(formatCountdown(7_000)).toBe("7s");
  expect(formatCountdown(6_200)).toBe("7s"); // ceil
  expect(formatCountdown(0)).toBe("0s");
  expect(formatCountdown(-500)).toBe("0s");
});

test("sampledAgeMs parses an ISO timestamp into a non-negative age, or null", () => {
  const now = Date.parse("2026-06-27T12:00:30Z");
  expect(sampledAgeMs("2026-06-27T12:00:00Z", now)).toBe(30_000);
  expect(sampledAgeMs(undefined, now)).toBeNull();
  expect(sampledAgeMs("not-a-date", now)).toBeNull();
  expect(sampledAgeMs("2026-06-27T12:01:00Z", now)).toBe(0); // future sample → clamped
});
