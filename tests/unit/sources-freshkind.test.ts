import { expect, test } from "vitest";
import { unifyCoreFresh, unifySignalFresh, freshRank, worseFresh } from "@/lib/sources/freshKind";

test("core states map onto the unified kind (no 'empty' for core)", () => {
  expect(unifyCoreFresh("live")).toBe("live");
  expect(unifyCoreFresh("lagging")).toBe("lagging");
  expect(unifyCoreFresh("stale")).toBe("stale");
  expect(unifyCoreFresh("down")).toBe("down");
  expect(unifyCoreFresh("unknown")).toBe("unknown");
});

test("signal states map onto the unified kind, preserving 'empty'", () => {
  expect(unifySignalFresh("empty")).toBe("empty");
  expect(unifySignalFresh("live")).toBe("live");
  expect(unifySignalFresh("down")).toBe("down");
});

test("rank orders healthy below broken so worst-of picks the broken one", () => {
  expect(freshRank("live")).toBeLessThan(freshRank("lagging"));
  expect(freshRank("lagging")).toBeLessThan(freshRank("stale"));
  expect(freshRank("stale")).toBeLessThan(freshRank("down"));
  expect(freshRank("empty")).toBe(freshRank("live")); // both healthy
});

test("worseFresh returns the higher-ranked (worse) of two states", () => {
  expect(worseFresh("live", "stale")).toBe("stale");
  expect(worseFresh("down", "lagging")).toBe("down");
  expect(worseFresh("live", "empty")).toBe("live"); // tie → first; both healthy
});
