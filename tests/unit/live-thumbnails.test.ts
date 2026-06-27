import { describe, it, expect } from "vitest";
import { selectThumbnails } from "@/lib/map/liveThumbnails";

const t = (id: string) => ({ id, lon: 0, lat: 0, name: id });

describe("selectThumbnails", () => {
  it("de-dupes by id, keeping first occurrence", () => {
    const out = selectThumbnails([t("a"), t("a"), t("b")], 10);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("caps the result at max in input order", () => {
    const out = selectThumbnails([t("a"), t("b"), t("c"), t("d")], 2);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("returns [] for empty input", () => {
    expect(selectThumbnails([], 5)).toEqual([]);
  });
});
