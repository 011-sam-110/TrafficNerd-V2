import { expect, test } from "vitest";
import {
  classifySignalFreshness,
  signalFreshAgeMs,
  signalFreshLabel,
  type SignalFreshRecord,
} from "@/lib/signals/freshness";

const base = (over: Partial<SignalFreshRecord>): SignalFreshRecord => ({
  lastUpdate: 1_000_000,
  ok: true,
  count: 5,
  refreshMs: 60_000,
  ...over,
});

test("a fresh, non-empty fetch is live", () => {
  const r = base({ lastUpdate: 1_000_000, count: 5 });
  expect(classifySignalFreshness(r, 1_000_000 + 30_000)).toBe("live"); // < 2× refresh
});

test("fetched OK but zero features is 'empty', not stale or broken", () => {
  const r = base({ count: 0 });
  expect(classifySignalFreshness(r, 1_000_000 + 1_000)).toBe("empty");
  expect(signalFreshLabel("empty", "")).toBe("live · none right now");
});

test("ages into lagging then stale by multiples of the cadence", () => {
  const r = base({ count: 5, refreshMs: 60_000 });
  expect(classifySignalFreshness(r, 1_000_000 + 60_000 * 3)).toBe("lagging"); // 2×–6×
  expect(classifySignalFreshness(r, 1_000_000 + 60_000 * 7)).toBe("stale"); // ≥ 6×
});

test("stale takes precedence over empty once truly old", () => {
  const r = base({ count: 0, refreshMs: 60_000 });
  expect(classifySignalFreshness(r, 1_000_000 + 60_000 * 7)).toBe("stale");
});

test("failed fetch is down; never-fetched is unknown", () => {
  expect(classifySignalFreshness(base({ ok: false }), 2_000_000)).toBe("down");
  expect(classifySignalFreshness(base({ lastUpdate: null }), 2_000_000)).toBe("unknown");
  expect(signalFreshLabel("down", "")).toBe("unavailable");
  expect(signalFreshLabel("unknown", "")).toBe("connecting…");
});

test("age helper is null before first fetch, clamped non-negative otherwise", () => {
  expect(signalFreshAgeMs(base({ lastUpdate: null }), 5)).toBeNull();
  expect(signalFreshAgeMs(base({ lastUpdate: 1_000 }), 4_000)).toBe(3_000);
  expect(signalFreshAgeMs(base({ lastUpdate: 5_000 }), 4_000)).toBe(0); // clock skew → clamped
});
