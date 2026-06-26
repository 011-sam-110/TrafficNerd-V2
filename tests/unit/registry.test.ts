import { expect, test } from "vitest";
import { mergeResults } from "@/lib/sources/registry";
import type { Camera } from "@/lib/types";

const cam = (id: string): Camera => ({
  id, source: "x", country: "US", name: id, lat: 0, lon: 0,
  mediaType: "jpeg", refreshSeconds: 60, license: "L", attribution: "A", available: true,
});
const ok = (cams: Camera[]): PromiseSettledResult<Camera[]> => ({ status: "fulfilled", value: cams });
const fail = (): PromiseSettledResult<Camera[]> => ({ status: "rejected", reason: new Error("boom") });

test("unions all fulfilled sources", () => {
  expect(mergeResults([ok([cam("a")]), ok([cam("b"), cam("c")])], null).map((c) => c.id)).toEqual(["a", "b", "c"]);
});
test("ignores a rejected source when others succeed", () => {
  expect(mergeResults([ok([cam("a")]), fail()], null).map((c) => c.id)).toEqual(["a"]);
});
test("falls back to stale cache when everything fails", () => {
  expect(mergeResults([fail(), fail()], [cam("stale")]).map((c) => c.id)).toEqual(["stale"]);
});
test("throws when everything fails and there is no cache", () => {
  expect(() => mergeResults([fail()], null)).toThrow();
});
