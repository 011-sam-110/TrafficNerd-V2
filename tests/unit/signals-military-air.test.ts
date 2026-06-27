import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/adsb-mil.json";
import { normalizeMilitaryAir } from "@/lib/signals/military-air";

test("normalizes military ADS-B, skipping aircraft with no position", () => {
  const out = normalizeMilitaryAir(fixture as never);
  // 6 airborne + 1 grounded (has lat/lon) = 7; the position-less F16 is skipped.
  expect(out).toHaveLength(7);
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["military-air"]));
  expect(out.every((f) => f.id.startsWith("mil:"))).toBe(true);
});

test("maps callsign, type, altitude (incl. 'ground') and speed", () => {
  const out = normalizeMilitaryAir(fixture as never);
  const c17 = out.find((f) => f.props?.typeCode === "C17")!;
  expect(c17.title).toContain("RCH"); // a Reach military callsign
  expect(String(c17.props?.altitude)).toMatch(/ft$/);

  const grounded = out.find((f) => f.id === "mil:abc123")!;
  expect(grounded.props?.altitude).toBe("on ground");
  expect(grounded.props?.speed).toBe("0 kt");
  expect(grounded.ts).toBeUndefined(); // live snapshot, never time-filtered
});
