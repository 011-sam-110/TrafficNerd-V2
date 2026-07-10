import { expect, test } from "vitest";
// Schema-based fixture (no live storm to capture in the quiet season). Field shapes
// mirror a real NHC CurrentStorms.json active-storm record.
import fixture from "@/tests/fixtures/nhc-storms.json";
import {
  normalizeCyclones,
  cycloneCategory,
  TROPICAL_CYCLONES_SOURCE,
} from "@/lib/signals/tropical-cyclones";
import { rowMetric } from "@/lib/console/signals/signalCard";

test("normalizes active storms, skipping records with no usable position", () => {
  const out = normalizeCyclones(fixture as never);
  // Alberto (numeric), Carlotta (numeric), depression (string coords) = 3; "bad000" (no coords) skipped.
  expect(out).toHaveLength(3);
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["tropical-cyclones"]));

  const alberto = out.find((f) => f.id === "cyclone:al012026")!;
  expect(alberto.title).toContain("Alberto");
  expect(alberto.props?.category).toBe("Cat 4 hurricane"); // 120 kt
  expect(alberto.color).toBe("#7f1d1d");
  expect(alberto.props?.maxWind).toBe("120 kt");
  expect(alberto.props?.pressure).toBe("947 mb");
  expect(alberto.lat).toBeCloseTo(24.6);
  expect(alberto.lon).toBeCloseTo(-84.3);
});

test("parses string hemisphere coordinates when numeric fields are absent", () => {
  const out = normalizeCyclones(fixture as never);
  const dep = out.find((f) => f.id === "cyclone:wp052026")!;
  expect(dep.lat).toBeCloseTo(18.0);
  expect(dep.lon).toBeCloseTo(135.0); // 135.0E → positive
  expect(dep.props?.category).toBe("tropical depression");
});

test("exposes max sustained wind as a numeric metric field", () => {
  const out = normalizeCyclones(fixture as never);
  const alberto = out.find((f) => f.id === "cyclone:al012026")!;

  // Sibling numeric prop (real scalar), distinct from the "120 kt" display string.
  expect(alberto.props?.windKt).toBe(120);
  expect(typeof alberto.props?.windKt).toBe("number");

  // Source declares the metric pointing at that numeric field.
  expect(TROPICAL_CYCLONES_SOURCE.metric).toEqual({
    field: "windKt",
    domain: [34, 160],
    unit: " kt",
  });

  // rowMetric resolves it to the real value + domain (not the log-radius proxy).
  const m = rowMetric(alberto, TROPICAL_CYCLONES_SOURCE.metric);
  expect(m?.value).toBe(120);
  expect(m?.domain).toEqual([34, 160]);
});

test("Saffir–Simpson category mapping by wind/classification", () => {
  expect(cycloneCategory("HU", 140).label).toBe("Cat 5 hurricane");
  expect(cycloneCategory("HU", 120).label).toBe("Cat 4 hurricane");
  expect(cycloneCategory("HU", 100).label).toBe("Cat 3 hurricane");
  expect(cycloneCategory("HU", 85).label).toBe("Cat 2 hurricane");
  expect(cycloneCategory("HU", 70).label).toBe("Cat 1 hurricane");
  expect(cycloneCategory("TS", 50).label).toBe("tropical storm");
  expect(cycloneCategory("TD", 25).label).toBe("tropical depression");
  // Classification missing but wind high → still classified by wind.
  expect(cycloneCategory("", 100).label).toBe("Cat 3 hurricane");
});
