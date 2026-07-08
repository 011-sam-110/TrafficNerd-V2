import { describe, it, expect } from "vitest";
import { splitAntimeridian } from "@/lib/satellites/groundTrack";

describe("splitAntimeridian", () => {
  it("splits at a dateline crossing", () => {
    const segs = splitAntimeridian([[170, 0], [179, 0], [-179, 0], [-170, 0]]);
    expect(segs.length).toBe(2);
    expect(segs[0].length).toBe(2);
    expect(segs[1].length).toBe(2);
  });
  it("keeps a non-crossing track as one segment", () => {
    expect(splitAntimeridian([[0, 0], [10, 5], [20, 10]]).length).toBe(1);
  });
});
