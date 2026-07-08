import { describe, it, expect } from "vitest";
import { nextActive } from "@/lib/cameras/concurrency";

describe("nextActive", () => {
  it("adds an id and keeps it under the cap, evicting the oldest", () => {
    let a: string[] = [];
    for (const id of ["a", "b", "c"]) a = nextActive(a, id, 2);
    expect(a).toEqual(["b", "c"]); // "a" evicted
  });
  it("re-activating an existing id moves it to most-recent without growing", () => {
    const a = nextActive(["a", "b"], "a", 2);
    expect(a).toEqual(["b", "a"]);
  });
});
