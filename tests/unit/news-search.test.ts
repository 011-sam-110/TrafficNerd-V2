import { expect, test } from "vitest";
import { parseQuery, matchQuery, filterByQuery } from "@/lib/news/search";

const m = (q: string, text: string) => matchQuery(parseQuery(q), text);

test("implicit AND requires every term", () => {
  expect(m("iran strikes", "US strikes Iran overnight")).toBe(true);
  expect(m("iran strikes", "US strikes Syria overnight")).toBe(false);
});

test("OR separates alternative groups", () => {
  const q = parseQuery("iran OR ukraine");
  expect(q.groups).toHaveLength(2);
  expect(m("iran OR ukraine", "Ukraine war latest")).toBe(true);
  expect(m("iran OR ukraine", "Markets rally in Tokyo")).toBe(false);
});

test("-term excludes", () => {
  expect(m("strikes -iran", "US strikes Syria")).toBe(true);
  expect(m("strikes -iran", "US strikes Iran")).toBe(false);
});

test('"quoted phrase" matches contiguously', () => {
  expect(m('"patriot missiles"', "US sends patriot missiles to Kyiv")).toBe(true);
  expect(m('"patriot missiles"', "patriot systems and missiles")).toBe(false);
});

test("AND keyword is a no-op; empty query matches all", () => {
  expect(m("iran AND strikes", "Iran strikes reported")).toBe(true);
  expect(m("", "anything at all")).toBe(true);
  expect(parseQuery("   ").groups).toHaveLength(0);
});

test("case-insensitive matching", () => {
  expect(m("IRAN", "the iran report")).toBe(true);
});

test("filterByQuery filters a projection and passes through on empty", () => {
  const rows = [{ t: "Iran strikes" }, { t: "Ukraine talks" }];
  expect(filterByQuery(rows, "ukraine", (r) => r.t)).toEqual([{ t: "Ukraine talks" }]);
  expect(filterByQuery(rows, "", (r) => r.t)).toBe(rows);
});
