import { expect, test } from "vitest";
import { constituentIds, rollupCount, rollupFresh } from "@/lib/widgets/rollup";
import { catalogByGroup } from "@/lib/sources/catalog";

test("constituentIds returns the source ids of a group", () => {
  const g = catalogByGroup()[0];
  expect(constituentIds(g.group)).toEqual(g.sources.map((s) => s.id));
  expect(constituentIds("no-such-group")).toEqual([]);
});

test("rollupCount sums known counts, null when no constituent has data", () => {
  expect(rollupCount({ a: 3, b: 5 }, ["a", "b"])).toBe(8);
  expect(rollupCount({ a: 3 }, ["a", "b"])).toBe(3); // b unknown → skipped
  expect(rollupCount({}, ["a", "b"])).toBeNull(); // nothing known
});

test("rollupFresh is worst-of its constituents", () => {
  expect(rollupFresh(["live", "lagging", "stale"])).toBe("stale");
  expect(rollupFresh(["live", "empty"])).toBe("live"); // both healthy
  expect(rollupFresh([])).toBe("off"); // nothing placed/known
});
