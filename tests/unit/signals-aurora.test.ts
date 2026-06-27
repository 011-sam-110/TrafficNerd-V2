import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/aurora-ovation.json";
import { normalizeAurora, auroraColor, type OvationGrid } from "@/lib/signals/aurora";

const grid = fixture as unknown as OvationGrid;

test("keeps only high-probability cells and sorts by probability descending", () => {
  const out = normalizeAurora(grid); // default threshold 50
  // Excludes the 5% and 40% cells; keeps 6, brightest first.
  expect(out.map((f) => f.props?.probability)).toEqual(["90%", "80%", "70%", "60%", "55%", "52%"]);
  expect(out.every((f) => f.signalId === "aurora")).toBe(true);
});

test("wraps longitude 0..359 into -180..180 and tags forecast time", () => {
  const out = normalizeAurora(grid);
  const top = out[0]; // [200, 65, 90]
  expect(top.lon).toBe(-160); // 200 - 360
  expect(top.lat).toBe(65);
  expect(top.color).toBe(auroraColor(90));
  expect(top.title).toBe("Aurora 90% likely");
  expect(top.ts).toBe("2026-06-27T05:45:00Z");
  const last = out[out.length - 1]; // [359, -80, 55] survives the >=50 filter
  expect(out.some((f) => f.lon === -1)).toBe(true);
  expect(last).toBeDefined();
});

test("hard-caps the point count regardless of how active the grid is", () => {
  const out = normalizeAurora(grid, 50, 3);
  expect(out).toHaveLength(3);
  expect(out.map((f) => f.props?.probability)).toEqual(["90%", "80%", "70%"]);
});

test("colour ramp brightens with probability", () => {
  expect(auroraColor(55)).toBe("#22c55e");
  expect(auroraColor(95)).toBe("#ecfdf5");
});
