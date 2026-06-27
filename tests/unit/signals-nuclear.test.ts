import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/overpass-nuclear.json";
import { normalizeOverpassNuclear } from "@/lib/signals/nuclear";

test("normalizes Overpass nuclear plants, skipping unnamed elements", () => {
  const out = normalizeOverpassNuclear(fixture as never);
  // 4 elements in; the unnamed sentinel is skipped → 3 plants.
  expect(out).toHaveLength(3);
  expect(out.every((f) => f.signalId === "nuclear")).toBe(true);
  expect(out.some((f) => f.id === "nuclear:node/999999")).toBe(false);
});

test("uses node lat/lon and way center, surfacing output + operator", () => {
  const out = normalizeOverpassNuclear(fixture as never);
  const node = out.find((f) => f.id === "nuclear:node/8645134918");
  expect(node?.props?.output).toBe("57 MW");

  const way = out.find((f) => f.id === "nuclear:way/4800321");
  expect(way?.lat).toBeCloseTo(54.6352, 3); // from element.center
  expect(way?.lon).toBeCloseTo(-1.1813, 3);
  expect(way?.props?.output).toBe("1180 MW");
  expect(way?.props?.operator).toBe("EDF Energy");
  expect(way?.link).toBe("https://www.openstreetmap.org/way/4800321");
});
