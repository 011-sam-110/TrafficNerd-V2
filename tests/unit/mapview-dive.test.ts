import { describe, it, expect } from "vitest";
import { mapViewStore } from "@/lib/mapView";

describe("mapViewStore dive bridge", () => {
  it("diveTo is a no-op (no throw) when no handler is registered", () => {
    mapViewStore.registerDiveTo(null);
    expect(() => mapViewStore.diveTo({ lat: 1, lon: 2 }, true, () => {})).not.toThrow();
  });

  it("forwards view, animate flag and onArrive to the registered handler", () => {
    const calls: Array<{ lat: number; lon: number; animate: boolean }> = [];
    let arrived = false;
    mapViewStore.registerDiveTo((view, animate, onArrive) => {
      calls.push({ lat: view.lat, lon: view.lon, animate });
      onArrive();
    });
    mapViewStore.diveTo({ lat: 51.5, lon: -0.12 }, false, () => { arrived = true; });
    expect(calls).toEqual([{ lat: 51.5, lon: -0.12, animate: false }]);
    expect(arrived).toBe(true);
    mapViewStore.registerDiveTo(null);
  });
});
