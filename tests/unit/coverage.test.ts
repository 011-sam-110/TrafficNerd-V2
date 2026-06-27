import { expect, test } from "vitest";
import { groupCoverage } from "@/lib/coverage";

test("groups by source with total + online counts", () => {
  const cov = groupCoverage([
    { source: "tfl", available: true },
    { source: "tfl", available: false },
    { source: "caltrans", available: true },
    { source: "caltrans", available: true },
    { source: "caltrans", available: true },
  ]);
  expect(cov.total).toBe(5);
  expect(cov.online).toBe(4);
  expect(cov.sources[0]).toEqual({ source: "caltrans", total: 3, online: 3 });
  expect(cov.sources[1]).toEqual({ source: "tfl", total: 2, online: 1 });
});

test("sorts by total desc, then source id for stable ties", () => {
  const cov = groupCoverage([
    { source: "zeta", available: true },
    { source: "alpha", available: false },
  ]);
  expect(cov.sources.map((s) => s.source)).toEqual(["alpha", "zeta"]);
});

test("empty input yields zeroed coverage", () => {
  expect(groupCoverage([])).toEqual({ total: 0, online: 0, sources: [] });
});
