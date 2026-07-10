import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/hungermap-food.json";
import { normalizeFoodSecurity, foodInsecurityColor, FOOD_SECURITY_SOURCE } from "@/lib/signals/food-security";
import { centroidByIso3 } from "@/lib/signals/country-centroids.data";
import { rowMetric } from "@/lib/console/signals/signalCard";

test("normalizes HungerMap food insecurity by country, skipping unknown/zero rows", () => {
  const out = normalizeFoodSecurity(fixture as never);
  expect(out).toHaveLength(6); // 6 real countries; the "ZZZ" / zero-people row is dropped
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["food-security"]));

  const afg = out.find((f) => f.id === "food:AFG")!;
  expect(afg.props?.insufficientFood).toBe((23_075_100).toLocaleString());
  expect(afg.props?.prevalence).toBe("57%"); // 0.5709… → 57%
  expect(afg.color).toBe(foodInsecurityColor(0.5709982309895716));
  expect(afg.ts).toBeUndefined(); // nowcast snapshot, never time-filtered
  const ctr = centroidByIso3("AFG")!;
  expect(afg.lon).toBe(ctr.lon);
});

test("FCS prevalence resolves as the real metric (finite % scalar, not the radius proxy)", () => {
  const out = normalizeFoodSecurity(fixture as never);
  const afg = out.find((f) => f.id === "food:AFG")!;

  // A finite numeric sibling prop must back the display string.
  expect(typeof afg.props?.prevalencePct).toBe("number");
  expect(Number.isFinite(afg.props?.prevalencePct as number)).toBe(true);
  expect(afg.props?.prevalencePct).toBe(57); // Math.round(0.5709… * 100)

  // The declared metric points at that field with a numeric-literal domain.
  expect(FOOD_SECURITY_SOURCE.metric).toEqual({ field: "prevalencePct", domain: [5, 50], unit: " %" });

  const m = rowMetric(afg, FOOD_SECURITY_SOURCE.metric)!;
  expect(m.value).toBe(57);
  expect(m.domain).toEqual([5, 50]);
  expect(m.label).toBe("57 %");
});

test("prevalence colour ramp", () => {
  expect(foodInsecurityColor(0.45)).toBe("#7f1d1d");
  expect(foodInsecurityColor(0.3)).toBe("#dc2626");
  expect(foodInsecurityColor(0.18)).toBe("#ea580c");
  expect(foodInsecurityColor(0.08)).toBe("#f59e0b");
  expect(foodInsecurityColor(0.02)).toBe("#fbbf24");
});
