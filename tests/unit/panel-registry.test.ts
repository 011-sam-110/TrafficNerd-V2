import { describe, it, expect } from "vitest";
import { PANEL_REGISTRY } from "@/lib/shell/panelRegistry";

describe("PANEL_REGISTRY", () => {
  it("has an entry for every panel key", () => {
    for (const key of ["layerRail", "markets", "brief", "freshness", "news", "watchlist", "coverage"] as const) {
      expect(PANEL_REGISTRY[key]).toBeTruthy();
      expect(typeof PANEL_REGISTRY[key].title).toBe("string");
      expect(PANEL_REGISTRY[key].component).toBeTruthy();
    }
  });
});
