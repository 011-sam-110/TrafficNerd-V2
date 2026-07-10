import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/overpass-nuclear.json";
import { normalizeOverpassNuclear, NUCLEAR_SOURCE } from "@/lib/signals/nuclear";
import { rowMetric } from "@/lib/console/signals/signalCard";

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

test("prefers OSM's English name where present, else the default name", () => {
  const out = normalizeOverpassNuclear(fixture as never);
  // node 8645134918 has name "RHF de l'Institut Laue Langevin" + name:en "High-flux Reactor".
  expect(out.find((f) => f.id === "nuclear:node/8645134918")?.title).toBe("High-flux Reactor");
  // node 6443114600 has no name:en → keeps its default name.
  expect(out.find((f) => f.id === "nuclear:node/6443114600")?.title).toBe("Indústrias Nucleares do Brasil");
});

test("adds a numeric outputMw prop that the declared metric resolves to a bar", () => {
  const out = normalizeOverpassNuclear(fixture as never);

  const way = out.find((f) => f.id === "nuclear:way/4800321");
  expect(way?.props?.outputMw).toBe(1180);
  expect(typeof way?.props?.outputMw).toBe("number");
  expect(Number.isFinite(way?.props?.outputMw)).toBe(true);

  const node = out.find((f) => f.id === "nuclear:node/8645134918");
  expect(node?.props?.outputMw).toBe(57);

  // The source's metric points at the real numeric field with a sane domain.
  expect(NUCLEAR_SOURCE.metric).toEqual({ field: "outputMw", domain: [0, 8000], unit: " MW" });

  // rowMetric reads the real scalar (not the radius proxy) and formats the label.
  const bar = rowMetric(way!, NUCLEAR_SOURCE.metric);
  expect(bar).toEqual({ value: 1180, domain: [0, 8000], label: "1180 MW" });

  // The unnamed / capacity-less plant carries no outputMw and no bar.
  const capacityless = out.find((f) => f.id === "nuclear:node/6443114600");
  expect(capacityless?.props?.outputMw).toBeUndefined();
  expect(rowMetric(capacityless!, NUCLEAR_SOURCE.metric)).toBeUndefined();
});

test("registers as an asset directory ranked by capacity, described by operator", () => {
  // OSM carries no country → the directory ranks by the MW metric and shows operator.
  expect(NUCLEAR_SOURCE.kind).toBe("asset");
  expect(NUCLEAR_SOURCE.directory?.detailKey).toBe("operator");
  expect(NUCLEAR_SOURCE.directory?.codeKey).toBeUndefined();
});
