import { expect, test } from "vitest";
import {
  readGroupBy,
  readCollapsed,
  collapseKey,
  isCollapsed,
  toggleCollapsed,
  DEFAULT_GROUP_BY,
} from "@/lib/events/opsConfig";

test("readGroupBy accepts valid modes and defaults on junk", () => {
  expect(readGroupBy({ evGroupBy: "type" })).toBe("type");
  expect(readGroupBy({ evGroupBy: "region" })).toBe("region");
  expect(readGroupBy({ evGroupBy: "none" })).toBe("none");
  expect(readGroupBy({})).toBe(DEFAULT_GROUP_BY);
  expect(readGroupBy({ evGroupBy: "garbage" })).toBe(DEFAULT_GROUP_BY);
  expect(readGroupBy({ evGroupBy: 5 })).toBe(DEFAULT_GROUP_BY);
});

test("readCollapsed keeps only boolean entries, else {}", () => {
  expect(readCollapsed({ evCollapsed: { "region:asia": true, "region:eu": false } })).toEqual({
    "region:asia": true,
    "region:eu": false,
  });
  expect(readCollapsed({ evCollapsed: { a: 1, b: "x", c: true } })).toEqual({ c: true });
  expect(readCollapsed({})).toEqual({});
  expect(readCollapsed({ evCollapsed: [1, 2] })).toEqual({});
  expect(readCollapsed({ evCollapsed: null })).toEqual({});
});

test("collapseKey namespaces by mode so ids never collide", () => {
  expect(collapseKey("region", "asia")).toBe("region:asia");
  expect(collapseKey("type", "quake")).toBe("type:quake");
});

test("isCollapsed / toggleCollapsed round-trip", () => {
  let c: Record<string, boolean> = {};
  expect(isCollapsed(c, "region", "asia")).toBe(false); // absent = expanded
  c = toggleCollapsed(c, "region", "asia");
  expect(isCollapsed(c, "region", "asia")).toBe(true);
  expect(isCollapsed(c, "region", "eu")).toBe(false); // untouched
  c = toggleCollapsed(c, "region", "asia");
  expect(isCollapsed(c, "region", "asia")).toBe(false);
});

test("toggleCollapsed is pure (does not mutate input)", () => {
  const c = { "region:asia": true };
  const next = toggleCollapsed(c, "region", "asia");
  expect(c).toEqual({ "region:asia": true });
  expect(next).toEqual({ "region:asia": false });
});
