import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/emsc-quakes.json";
import { normalizeEmsc } from "@/lib/signals/emsc";
import { magnitudeColor } from "@/lib/signals/usgs";

test("normalizes EMSC quakes, skipping null-geometry events", () => {
  const out = normalizeEmsc(fixture as never);
  expect(out).toHaveLength(3); // 3 located events; the null-geometry "BADGEO" is skipped
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["emsc-quakes"]));

  const [top] = out;
  expect(top.id).toBe("emsc:20260627_0000100");
  expect(top.lat).toBeCloseTo(-8.9563, 4);
  expect(top.lon).toBeCloseTo(111.1499, 4);
  expect(top.props?.magnitude).toBe(5.2);
  expect(top.props?.depth).toBe("65.6 km");
  expect(top.props?.region).toBe("JAVA, INDONESIA");
  expect(top.color).toBe(magnitudeColor(5.2));
  expect(top.ts).toBe("2026-06-27T07:47:23.012Z");
  expect(top.link).toContain("20260627_0000100");
});
