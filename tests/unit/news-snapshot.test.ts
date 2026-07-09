import { expect, test } from "vitest";
import { snapshotOf, diffSnapshots } from "@/lib/news/snapshot";

test("snapshotOf maps url → title (skips blank urls)", () => {
  expect(snapshotOf([{ url: "a", title: "T1" }, { url: "b", title: "T2" }, { url: "", title: "X" }])).toEqual({
    a: "T1",
    b: "T2",
  });
});

test("diffSnapshots flags changed titles only", () => {
  const prev = { a: "Old headline", b: "Unchanged" };
  const now = [
    { url: "a", title: "Old headline (updated)" },
    { url: "b", title: "Unchanged" },
    { url: "c", title: "Brand new" }, // new url is not a "change"
  ];
  expect(diffSnapshots(prev, now)).toEqual([{ url: "a", from: "Old headline", to: "Old headline (updated)" }]);
});

test("no prior snapshot → no changes (honest, no baseline)", () => {
  expect(diffSnapshots(null, [{ url: "a", title: "T" }])).toEqual([]);
});
