import { describe, it, expect } from "vitest";
import { encodeViewState, decodeViewState } from "@/lib/share/url";

describe("url variant params", () => {
  it("round-trips v + sig", () => {
    const qs = encodeViewState({ v: "intel", sig: ["earthquakes", "cyber-c2"] });
    const back = decodeViewState(new URLSearchParams(qs));
    expect(back.v).toBe("intel");
    expect(back.sig).toEqual(["earthquakes", "cyber-c2"]);
  });
  it("drops an invalid variant id and unknown signal ids", () => {
    const back = decodeViewState(new URLSearchParams("v=BAD*ID&sig=earthquakes,not-a-signal"));
    expect(back.v).toBeUndefined();
    expect(back.sig).toEqual(["earthquakes"]);
  });
});
