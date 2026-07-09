import { expect, test } from "vitest";
import type { SignalFeature } from "@/lib/signals/types";
import {
  cableAssets,
  filterCables,
  sortCables,
  statusOptions,
  regionOptions,
  ownerOptions,
  summarize,
  landingAssets,
  filterLandings,
  sortLandings,
  EMPTY_FILTER,
} from "@/lib/console/signals/cableDetail";

function cable(id: string, props: Record<string, unknown>): SignalFeature {
  return { id: `cable:${id}`, lat: 0, lon: 0, title: props.name as string, signalId: "cables", props };
}

const FEATURES: SignalFeature[] = [
  cable("marea", { assetKind: "cable", name: "MAREA", status: "Operational", rfsYear: 2018, lengthKm: 6605, capacity: "—", owners: "Meta, Microsoft, Telxius", suppliers: "SubCom", region: "Transatlantic", length: "6,605 km", landingPoints: 2, landings: "Bilbao · Virginia Beach" }),
  cable("dunant", { assetKind: "cable", name: "Dunant", status: "Operational", rfsYear: 2021, lengthKm: 6400, capacity: "—", owners: "Google", suppliers: "SubCom", region: "Transatlantic", length: "6,400 km", landingPoints: 2 }),
  cable("planned", { assetKind: "cable", name: "Future Link", status: "Planned", rfsYear: 2027, lengthKm: null, capacity: "—", owners: "Meta", suppliers: "—", region: "Transpacific", length: "—", landingPoints: 3 }),
];

test("cableAssets projects props into typed rows", () => {
  const rows = cableAssets(FEATURES);
  expect(rows).toHaveLength(3);
  expect(rows[0].name).toBe("MAREA");
  expect(rows[0].lengthKm).toBe(6605);
  expect(rows[2].rfsYear).toBe(2027);
  expect(rows[2].lengthKm).toBeNull();
});

test("filter option lists contain only present values (no dead options)", () => {
  const rows = cableAssets(FEATURES);
  expect(statusOptions(rows)).toEqual(["Operational", "Planned"]);
  expect(regionOptions(rows)).toEqual(["Transatlantic", "Transpacific"]); // canonical order
  // Owners split out of consortium strings, ranked by frequency (Meta appears twice).
  expect(ownerOptions(rows)[0]).toBe("Meta");
  expect(ownerOptions(rows)).toContain("Telxius");
});

test("filterCables applies Status / Region / Owner (substring, case-insensitive)", () => {
  const rows = cableAssets(FEATURES);
  expect(filterCables(rows, { ...EMPTY_FILTER, status: "Planned" }).map((r) => r.name)).toEqual(["Future Link"]);
  expect(filterCables(rows, { ...EMPTY_FILTER, region: "Transatlantic" }).map((r) => r.name).sort()).toEqual(["Dunant", "MAREA"]);
  expect(filterCables(rows, { ...EMPTY_FILTER, owner: "google" }).map((r) => r.name)).toEqual(["Dunant"]);
  expect(filterCables(rows, { ...EMPTY_FILTER, owner: "meta" })).toHaveLength(2);
});

test("sortCables ranks by RFS year and pushes missing length last either way", () => {
  const rows = cableAssets(FEATURES);
  expect(sortCables(rows, "rfsYear", -1).map((r) => r.name)).toEqual(["Future Link", "Dunant", "MAREA"]);
  // Ascending length: the null-length cable sorts last, never first.
  expect(sortCables(rows, "lengthKm", 1).map((r) => r.name)).toEqual(["Dunant", "MAREA", "Future Link"]);
});

test("summarize replaces event histograms with asset stats", () => {
  const s = summarize(cableAssets(FEATURES));
  expect(s.total).toBe(3);
  expect(s.operational).toBe(2);
  expect(s.planned).toBe(1);
  expect(s.totalLengthKm).toBe(13005); // 6605 + 6400, the null is excluded
  expect(s.knownLength).toBe(2);
  expect(s.regions.find((r) => r.region === "Transatlantic")?.count).toBe(2);
});

test("landing asset helpers project, filter and rank hubs by cable count", () => {
  const landings: SignalFeature[] = [
    { id: "landing:a", lat: 0, lon: 0, title: "Marseille, France", signalId: "cable-landings", props: { assetKind: "landing", cableCount: 15, cables: "2Africa · SEA-ME-WE" } },
    { id: "landing:b", lat: 0, lon: 0, title: "Bilbao, Spain", signalId: "cable-landings", props: { assetKind: "landing", cableCount: 2, cables: "MAREA · Grace Hopper" } },
  ];
  const rows = landingAssets(landings);
  expect(sortLandings(rows, "cableCount", -1)[0].name).toBe("Marseille, France");
  expect(filterLandings(rows, "grace")).toHaveLength(1); // matches on cable name too
  expect(filterLandings(rows, "marseille").map((r) => r.name)).toEqual(["Marseille, France"]);
});
