import { expect, test } from "vitest";
import { rankAnomalies, featureSeverity, recencyWeight, type AnomalyInput } from "@/lib/console/anomaly/anomaly";
import type { SignalFeature, SignalMetric } from "@/lib/signals/types";

const NOW = Date.parse("2026-07-10T12:00:00Z");
const METRIC: SignalMetric = { field: "mag", domain: [0, 9], unit: "" };
const f = (id: string, mag: number, ts?: string): SignalFeature => ({
  id, lat: 1, lon: 2, title: id, signalId: "quakes", color: "#f00", ts, props: { mag },
});
const input = (features: SignalFeature[]): AnomalyInput => ({ id: "quakes", label: "Quakes", color: "#f00", metric: METRIC, features });

test("featureSeverity normalises the real metric, else the magnitude proxy", () => {
  expect(featureSeverity(f("a", 9), METRIC).sev).toBeCloseTo(1);
  expect(featureSeverity(f("b", 4.5), METRIC).sev).toBeCloseTo(0.5);
  expect(featureSeverity(f("c", 6), METRIC).label).toBe("6");
  // No metric → falls back to props.magnitude / 10.
  const g: SignalFeature = { id: "g", lat: 0, lon: 0, title: "g", signalId: "x", props: { magnitude: 8 } };
  expect(featureSeverity(g).sev).toBeCloseTo(0.8);
});

test("recencyWeight decays with age and is honest about undated items", () => {
  expect(recencyWeight("2026-07-10T11:30:00Z", NOW).w).toBe(1); // 30m
  expect(recencyWeight("2026-07-10T04:00:00Z", NOW).w).toBe(0.6); // 8h
  expect(recencyWeight(undefined, NOW).w).toBe(0.4);
});

test("rankAnomalies filters routine items below the severity floor", () => {
  const rows = rankAnomalies([input([f("big", 8), f("mid", 6), f("small", 3)])], NOW);
  // mag 3 → 0.33 severity, below the 0.45 floor → dropped.
  expect(rows.map((r) => r.id)).toEqual(["big", "mid"]);
  expect(rows[0].valueLabel).toBe("8");
});

test("rankAnomalies ranks by severity then recency; newer wins on a tie", () => {
  const rows = rankAnomalies([input([f("old", 6, "2026-07-01T00:00:00Z"), f("new", 6, "2026-07-10T11:45:00Z")])], NOW);
  expect(rows.map((r) => r.id)).toEqual(["new", "old"]); // same severity, fresher first
  expect(rows[0].score).toBeGreaterThan(rows[1].score);
});

test("rankAnomalies caps output and carries layer identity", () => {
  const many = Array.from({ length: 30 }, (_, i) => f(`q${i}`, 8));
  const rows = rankAnomalies([input(many)], NOW, { cap: 5 });
  expect(rows).toHaveLength(5);
  expect(rows[0].layerLabel).toBe("Quakes");
  expect(rows[0].layerId).toBe("quakes");
});
