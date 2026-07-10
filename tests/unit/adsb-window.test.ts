import { describe, it, expect } from "vitest";
import {
  windowIndices,
  applyWindow,
  collectFresh,
  ADSB_GRID,
  WINDOW_SIZE,
  type Aircraft,
  type CellStore,
} from "@/lib/sources/adsb";

// Minimal Aircraft fixture — only hex/lat/lon matter for the window/merge logic.
function ac(hex: string, lat = 0, lon = 0): Aircraft {
  return {
    hex,
    callsign: hex,
    lat,
    lon,
    altKm: 10,
    headingDeg: 0,
    velocityMs: 200,
    verticalRateMs: 0,
    onGround: false,
    category: "A3",
    typeCode: "A320",
    registration: "",
    squawk: "",
  };
}

describe("windowIndices — rotating strided window", () => {
  const gridLen = 52;
  const size = 6;
  const numWindows = Math.ceil(gridLen / size); // 9

  it("covers every grid index exactly once over one full rotation", () => {
    const seen: number[] = [];
    for (let step = 0; step < numWindows; step++) seen.push(...windowIndices(gridLen, size, step));
    seen.sort((a, b) => a - b);
    expect(seen).toEqual([...Array(gridLen).keys()]); // 0..51, no gaps, no dupes
  });

  it("keeps each window at or below the window size", () => {
    for (let step = 0; step < numWindows; step++) {
      expect(windowIndices(gridLen, size, step).length).toBeLessThanOrEqual(size);
    }
  });

  it("is STRIDED — a single window spans the whole grid, not a contiguous NA-first block", () => {
    const w0 = windowIndices(gridLen, size, 0);
    // A contiguous window would be {0,1,2,3,4,5} (all the North-America cells);
    // strided must instead reach from the very first cell to near the very last.
    expect(Math.min(...w0)).toBeLessThan(numWindows); // a low (Americas) index
    expect(Math.max(...w0)).toBeGreaterThanOrEqual(gridLen - numWindows); // a high (Asia/Oceania) index
    // consecutive picks are a full stride apart, never adjacent
    for (let i = 1; i < w0.length; i++) expect(w0[i] - w0[i - 1]).toBe(numWindows);
  });

  it("wraps: step === numWindows repeats step 0, and negative steps are safe", () => {
    expect(windowIndices(gridLen, size, numWindows)).toEqual(windowIndices(gridLen, size, 0));
    expect(windowIndices(gridLen, size, numWindows * 3 + 2)).toEqual(windowIndices(gridLen, size, 2));
    expect(windowIndices(gridLen, size, -1)).toEqual(windowIndices(gridLen, size, numWindows - 1));
  });

  it("real ADSB_GRID window 0 actually spans multiple continents (not US-only)", () => {
    const w0 = windowIndices(ADSB_GRID.length, WINDOW_SIZE, 0).map((i) => ADSB_GRID[i]);
    expect(w0.some((c) => c.lon < -50)).toBe(true); // Americas
    expect(w0.some((c) => c.lon > 50)).toBe(true); // Asia / Middle East
    expect(w0.some((c) => c.lat < 0)).toBe(true); // southern hemisphere
  });

  it("handles degenerate inputs without throwing", () => {
    expect(windowIndices(0, 6, 0)).toEqual([]);
    expect(windowIndices(52, 0, 0)).toEqual([]);
    expect(windowIndices(3, 10, 0)).toEqual([0, 1, 2]); // window larger than grid → one window, all cells
  });
});

describe("applyWindow — rolling per-cell merge", () => {
  it("stores each successful cell's aircraft stamped with the fetch time", () => {
    const store: CellStore = new Map();
    applyWindow(store, [{ index: 3, aircraft: [ac("a")] }], 1000);
    expect(store.get(3)).toEqual({ at: 1000, aircraft: [ac("a")] });
  });

  it("overwrites a cell with its newer result", () => {
    const store: CellStore = new Map();
    applyWindow(store, [{ index: 3, aircraft: [ac("old")] }], 1000);
    applyWindow(store, [{ index: 3, aircraft: [ac("new")] }], 2000);
    expect(store.get(3)).toEqual({ at: 2000, aircraft: [ac("new")] });
  });

  it("leaves cells NOT in this window untouched (last-good is preserved on failure)", () => {
    const store: CellStore = new Map();
    applyWindow(store, [{ index: 1, aircraft: [ac("keep")] }], 1000);
    // A later window that only touched cell 2 must not disturb cell 1.
    applyWindow(store, [{ index: 2, aircraft: [ac("other")] }], 2000);
    expect(store.get(1)).toEqual({ at: 1000, aircraft: [ac("keep")] });
    expect(store.get(2)).toEqual({ at: 2000, aircraft: [ac("other")] });
  });
});

describe("collectFresh — TTL prune + deduped union", () => {
  const TTL = 240_000;

  it("returns [] for an empty store", () => {
    expect(collectFresh(new Map(), 1000, TTL)).toEqual([]);
  });

  it("unions aircraft across all fresh cells", () => {
    const store: CellStore = new Map();
    applyWindow(store, [{ index: 1, aircraft: [ac("a")] }], 1000);
    applyWindow(store, [{ index: 2, aircraft: [ac("b"), ac("c")] }], 1000);
    const hexes = collectFresh(store, 1000, TTL).map((a) => a.hex).sort();
    expect(hexes).toEqual(["a", "b", "c"]);
  });

  it("drops (and evicts) cells older than the TTL, keeps fresh ones", () => {
    const store: CellStore = new Map();
    applyWindow(store, [{ index: 1, aircraft: [ac("stale")] }], 0);
    applyWindow(store, [{ index: 2, aircraft: [ac("fresh")] }], 200_000);
    const now = 300_000; // cell 1 aged 300s (> TTL), cell 2 aged 100s (< TTL)
    const hexes = collectFresh(store, now, TTL).map((a) => a.hex);
    expect(hexes).toEqual(["fresh"]);
    expect(store.has(1)).toBe(false); // expired cell evicted from the store
    expect(store.has(2)).toBe(true);
  });

  it("dedupes a plane seen by two overlapping cells, keeping the FRESHEST position", () => {
    const store: CellStore = new Map();
    applyWindow(store, [{ index: 1, aircraft: [ac("dup", 10, 10)] }], 1000); // older
    applyWindow(store, [{ index: 2, aircraft: [ac("dup", 20, 20)] }], 2000); // newer
    const out = collectFresh(store, 2000, TTL);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ hex: "dup", lat: 20, lon: 20 }); // newer wins
  });
});

describe("integration — a full rotation fills the globe, then cells age out", () => {
  it("accumulates every grid cell's planes over one rotation, then prunes on silence", () => {
    const store: CellStore = new Map();
    const size = WINDOW_SIZE;
    const numWindows = Math.ceil(ADSB_GRID.length / size);
    const TTL = 240_000;
    const stepMs = 15_000; // one revalidation per WINDOW_S

    // One plane per cell, hex = "cell<index>". Walk a full rotation.
    let t = 0;
    for (let step = 0; step < numWindows; step++) {
      const successes = windowIndices(ADSB_GRID.length, size, step).map((index) => ({
        index,
        aircraft: [ac(`cell${index}`)],
      }));
      applyWindow(store, successes, t);
      t += stepMs;
    }

    // After the rotation, every cell that is still within the TTL is served.
    const afterRotation = collectFresh(store, t, TTL);
    expect(afterRotation).toHaveLength(ADSB_GRID.length); // whole globe covered
    expect(store.size).toBe(ADSB_GRID.length);

    // Now go silent (no more refreshes) well past the TTL: everything ages out.
    const later = collectFresh(store, t + TTL + stepMs, TTL);
    expect(later).toEqual([]);
    expect(store.size).toBe(0);
  });
});
