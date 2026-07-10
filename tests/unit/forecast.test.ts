import { expect, test } from "vitest";
import { pickBand, hemisphereExtent, extentLabel, type ForecastBand } from "@/lib/console/signals/forecast";

const KP: ForecastBand[] = [
  { min: 0, label: "Quiet", color: "#16a34a" },
  { min: 4, label: "Unsettled", color: "#eab308" },
  { min: 5, label: "Minor storm (G1)", color: "#f59e0b" },
  { min: 7, label: "Strong storm (G3+)", color: "#dc2626" },
];

test("pickBand returns the highest band the value clears", () => {
  expect(pickBand(2.3, KP)?.label).toBe("Quiet");
  expect(pickBand(4.7, KP)?.label).toBe("Unsettled");
  expect(pickBand(5, KP)?.label).toBe("Minor storm (G1)");
  expect(pickBand(8.1, KP)?.label).toBe("Strong storm (G3+)");
});

test("pickBand degrades honestly on empty/NaN", () => {
  expect(pickBand(3, [])).toBeNull();
  expect(pickBand(Number.NaN, KP)).toBeNull();
});

test("hemisphereExtent finds the most equatorward latitude per hemisphere", () => {
  const e = hemisphereExtent([67, 71, 55, -60, -47, -80]);
  expect(e.north).toBe(55); // closest to the equator in the north
  expect(e.south).toBe(-47); // closest to the equator in the south
});

test("hemisphereExtent returns null for an absent hemisphere", () => {
  const e = hemisphereExtent([70, 62, 58]);
  expect(e.north).toBe(58);
  expect(e.south).toBeNull();
});

test("extentLabel renders a hemisphere-tagged degree, or empty when null", () => {
  expect(extentLabel(55)).toBe("55°N");
  expect(extentLabel(-47.4)).toBe("47°S");
  expect(extentLabel(null)).toBe("");
});
