import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/launches.json";
import { normalizeLaunches, launchStatusColor, LAUNCHES_SOURCE } from "@/lib/signals/launches";

test("normalizes LL2 launches to pad points, skipping pad-less ones", () => {
  const out = normalizeLaunches(fixture as never);
  // 4 results in; the synthetic null-pad launch is skipped → 3 features.
  expect(out).toHaveLength(3);
  expect(out.every((f) => f.signalId === "launches")).toBe(true);
  expect(out.every((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon))).toBe(true);
  expect(out.some((f) => f.id === "launch:no-pad-x")).toBe(false);
});

test("maps pad coords (string→number), provider, rocket, status and net", () => {
  const [a] = normalizeLaunches(fixture as never);
  expect(a.lat).toBeCloseTo(8.716667, 5);
  expect(a.lon).toBeCloseTo(167.733333, 5);
  expect(a.props?.provider).toBe("Northrop Grumman Space Systems");
  expect(a.props?.rocket).toBe("Pegasus XL");
  expect(a.props?.status).toBe("Go for Launch");
  expect(a.ts).toBe("2026-06-27T09:00:00Z");
  expect(a.color).toBe(launchStatusColor("Go for Launch"));
});

test("status colour ramp: go=green, tbd=violet", () => {
  expect(launchStatusColor("Go for Launch")).toBe("#22c55e");
  expect(launchStatusColor("To Be Determined")).toBe("#a855f7");
  expect(launchStatusColor("Launch Failure")).toBe("#ef4444");
});

test("registers as a schedule so it renders the countdown agenda, not the event view", () => {
  expect(LAUNCHES_SOURCE.kind).toBe("schedule");
});
