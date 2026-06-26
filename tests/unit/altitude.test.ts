import { expect, test } from "vitest";
import { altKmToShell, planeKmToShell } from "@/lib/altitude";

const SHELL_MIN = 0.12;
const SHELL_MAX = 0.55;

test("altKmToShell maps GEO and LEO to the band edges", () => {
  expect(altKmToShell(300)).toBeCloseTo(SHELL_MIN, 10);
  expect(altKmToShell(36000)).toBeCloseTo(SHELL_MAX, 10);
});

test("altKmToShell keeps a typical LEO satellite low and visible", () => {
  const iss = altKmToShell(420); // ISS-ish
  expect(iss).toBeGreaterThan(SHELL_MIN);
  expect(iss).toBeLessThan(0.2);
});

test("altKmToShell is monotonic increasing across the orbital range", () => {
  const samples = [300, 420, 550, 800, 2000, 8000, 20000, 36000];
  for (let i = 1; i < samples.length; i++) {
    expect(altKmToShell(samples[i])).toBeGreaterThan(altKmToShell(samples[i - 1]));
  }
});

test("altKmToShell separates LEO from GEO enough to read both shells", () => {
  expect(altKmToShell(36000) - altKmToShell(550)).toBeGreaterThan(0.2);
});

test("altKmToShell clamps out-of-range and non-finite inputs into the band", () => {
  expect(altKmToShell(50)).toBeCloseTo(SHELL_MIN, 10); // below min → clamp up
  expect(altKmToShell(1_000_000)).toBeCloseTo(SHELL_MAX, 10); // above max → clamp down
  expect(altKmToShell(Number.NaN)).toBeCloseTo(SHELL_MIN, 10);
  expect(altKmToShell(Number.POSITIVE_INFINITY)).toBeCloseTo(SHELL_MIN, 10);
});

test("altKmToShell always returns a finite value inside the band", () => {
  for (const a of [-100, 0, 300, 12345, 36000, 99999]) {
    const s = altKmToShell(a);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(SHELL_MIN);
    expect(s).toBeLessThanOrEqual(SHELL_MAX);
  }
});

test("planeKmToShell sits below the satellite band so layering is correct", () => {
  // Highest plane shell must be below the lowest satellite shell.
  expect(planeKmToShell(13)).toBeLessThan(altKmToShell(300));
  expect(planeKmToShell(0)).toBeGreaterThan(0); // still above the camera surface
});

test("planeKmToShell is monotonic and clamped", () => {
  expect(planeKmToShell(0)).toBeCloseTo(0.006, 10);
  expect(planeKmToShell(13)).toBeCloseTo(0.03, 10);
  expect(planeKmToShell(6.5)).toBeCloseTo(0.018, 10);
  expect(planeKmToShell(-5)).toBeCloseTo(0.006, 10); // clamp
  expect(planeKmToShell(100)).toBeCloseTo(0.03, 10); // clamp
  expect(planeKmToShell(Number.NaN)).toBeCloseTo(0.006, 10);
});
