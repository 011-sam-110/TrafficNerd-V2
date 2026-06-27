import { describe, it, expect } from "vitest";
import { placementsToRglItems, rglItemsToPlacements } from "@/lib/variants/layout";
import type { PanelPlacement } from "@/lib/variants/types";

const P: PanelPlacement[] = [
  { panel: "markets", grid: { x: 9, y: 0, w: 3, h: 6, minW: 2, minH: 3 }, visible: true },
  { panel: "brief", grid: { x: 0, y: 0, w: 3, h: 6 }, visible: false },
];

describe("layout mappers", () => {
  it("maps visible placements to RGL items, carrying minW/minH", () => {
    const items = placementsToRglItems(P);
    expect(items).toEqual([{ i: "markets", x: 9, y: 0, w: 3, h: 6, minW: 2, minH: 3 }]);
  });

  it("round-trips grid changes back into placements, preserving visible + hidden panels", () => {
    const next = rglItemsToPlacements([{ i: "markets", x: 0, y: 2, w: 4, h: 5 }], P);
    expect(next.find((p) => p.panel === "markets")!.grid).toMatchObject({ x: 0, y: 2, w: 4, h: 5 });
    expect(next.find((p) => p.panel === "markets")!.visible).toBe(true);
    expect(next.find((p) => p.panel === "brief")).toEqual(P[1]); // untouched
  });
});
