import { describe, it, expect } from "vitest";
import { loadedCamerasStore } from "@/lib/cameras/loaded";

describe("loadedCamerasStore", () => {
  it("starts empty", () => {
    loadedCamerasStore.set([]);
    expect(loadedCamerasStore.get()).toEqual([]);
  });
  it("stores and returns the latest set", () => {
    const cams = [{ id: "a", name: "A", lat: 1, lon: 2, available: true, live: true }];
    loadedCamerasStore.set(cams);
    expect(loadedCamerasStore.get()).toHaveLength(1);
    expect(loadedCamerasStore.get()[0].id).toBe("a");
  });
});
