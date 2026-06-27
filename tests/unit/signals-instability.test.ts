import { expect, test } from "vitest";
import {
  computeInstability,
  normalizeFactor,
  instabilityColor,
  mergeFactors,
  FACTOR_WEIGHTS,
  type CountryInput,
} from "@/lib/signals/instability";

test("scores a multi-factor country and shows its work", () => {
  const inputs: CountryInput[] = [
    { iso3: "SYR", factors: { conflict: 1000, food: 0.45, displacement: 6_000_000, outages: 50_000 } },
  ];
  const out = computeInstability(inputs);
  expect(out).toHaveLength(1);
  const f = out[0];
  expect(f.id).toBe("cii:SYR");
  expect(f.signalId).toBe("instability");
  expect(f.props?.score).toBe(95); // weighted composite over the full weight set
  expect(f.color).toBe(instabilityColor(95)); // extreme → dark red
  expect(f.props?.coverage).toBe("4/4 factors");
  // Drivers ordered by weighted contribution — conflict (w=0.40) leads.
  expect(String(f.props?.drivers).startsWith("armed conflict")).toBe(true);
  // The breakdown exposes each factor's normalised sub-score.
  expect(f.props?.["food insecurity"]).toBe("90%");
});

test("missing factors pull the score down (conservative), not renormalised away", () => {
  // Food only, 30% prevalence → norm 0.6 → 0.6*0.25 = 0.15 → score 15 (NOT 60).
  const out = computeInstability([{ iso3: "SDN", factors: { food: 0.3 } }]);
  expect(out).toHaveLength(1);
  expect(out[0].props?.score).toBe(15);
  expect(out[0].props?.coverage).toBe("1/4 factors");
});

test("drops below-threshold countries and unknown ISO codes", () => {
  const out = computeInstability([
    { iso3: "DEU", factors: { food: 0.1 } }, // norm 0.2 → score 5 → below CII_MIN_SCORE
    { iso3: "XXX", factors: { conflict: 999 } }, // no centroid → skipped
  ]);
  expect(out).toHaveLength(0);
});

test("output is sorted by score, densest pressure first", () => {
  const out = computeInstability([
    { iso3: "SDN", factors: { food: 0.3 } }, // score 15
    { iso3: "SYR", factors: { conflict: 1000, food: 0.45, displacement: 6_000_000, outages: 50_000 } }, // 95
  ]);
  expect(out.map((f) => f.id)).toEqual(["cii:SYR", "cii:SDN"]);
});

test("factor normalisers ramp as documented; weights sum to 1", () => {
  expect(Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  expect(normalizeFactor("food", 0.5)).toBeCloseTo(1);
  expect(normalizeFactor("food", 1)).toBe(1); // clamped
  expect(normalizeFactor("food", 0)).toBe(0);
  expect(normalizeFactor("outages", 1_000_000)).toBeCloseTo(1);
  expect(normalizeFactor("conflict", 1000)).toBeCloseTo(1);
  expect(instabilityColor(90)).toBe("#7f1d1d");
  expect(instabilityColor(35)).toBe("#f59e0b");
  expect(instabilityColor(5)).toBe("#84cc16");
});

test("mergeFactors keys per-factor maps by ISO-3", () => {
  const inputs = mergeFactors([
    { key: "food", values: new Map([["SYR", 0.45], ["USA", 0.05]]) },
    { key: "conflict", values: new Map([["SYR", 1000]]) },
  ]);
  const syr = inputs.find((i) => i.iso3 === "SYR")!;
  expect(syr.factors.food).toBe(0.45);
  expect(syr.factors.conflict).toBe(1000);
  const usa = inputs.find((i) => i.iso3 === "USA")!;
  expect(usa.factors).toEqual({ food: 0.05 });
});
