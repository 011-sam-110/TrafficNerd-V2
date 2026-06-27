import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/cables-geo.json";
import { normalizeCables, CABLES_COLOR } from "@/lib/signals/cables";

test("normalizes (Multi)LineString cables, skipping non-line geometry", () => {
  const out = normalizeCables(fixture as never);
  // 3 features in; the Point feature is skipped → 2 line cables.
  expect(out).toHaveLength(2);
  expect(out.every((f) => f.signalId === "cables")).toBe(true);
  expect(out.some((f) => f.title === "Not a line")).toBe(false);
});

test("carries LineString geometry + a representative anchor + name", () => {
  const [a] = normalizeCables(fixture as never);
  expect(a.id).toBe("cable:bernacchi-1-0");
  expect(a.title).toBe("Bernacchi-1");
  expect(a.color).toBe(CABLES_COLOR);
  // Anchor centroid = the feature's precomputed [lon, lat] property.
  expect(a.lon).toBeCloseTo(146.6387, 3);
  expect(a.lat).toBeCloseTo(-40.3205, 3);
  // Geometry rides through for the WorldMap line layer.
  expect(a.geometry?.type).toBe("MultiLineString");
  expect(Array.isArray(a.geometry?.coordinates)).toBe(true);
  expect(a.props?.name).toBe("Bernacchi-1");
});
