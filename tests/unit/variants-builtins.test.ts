import { describe, it, expect } from "vitest";
import { BUILTIN_VARIANTS, BUILTIN_BY_ID, DEFAULT_VARIANT_ID } from "@/lib/variants/builtins";
import { SIGNALS } from "@/lib/signals/registry";

describe("built-in variants", () => {
  it("has explore as the default and it is minimal", () => {
    expect(DEFAULT_VARIANT_ID).toBe("explore");
    const explore = BUILTIN_BY_ID["explore"];
    expect(explore).toBeTruthy();
    expect(explore.layers.cameras).toBe(true);
    expect(explore.layers.planes).toBe(true);
    expect(explore.signals).toBeUndefined(); // no intel layers in the calm default
    expect(explore.panels.filter((p) => p.visible).map((p) => p.panel)).toEqual(["layerRail"]);
  });

  it("covers every registry signal group across the variant set", () => {
    const allGroups = new Set(SIGNALS.map((s) => s.group));
    const covered = new Set<string>();
    for (const v of BUILTIN_VARIANTS) {
      for (const g of v.signals?.groups ?? []) covered.add(g);
      // 'intel' selects all groups via a sentinel handled in resolveSignals
      if (v.id === "intel") allGroups.forEach((g) => covered.add(g));
    }
    // ids-bound variants contribute their ids' groups too
    const idGroup = new Map(SIGNALS.map((s) => [s.id, s.group]));
    for (const v of BUILTIN_VARIANTS) for (const id of v.signals?.ids ?? []) {
      const g = idGroup.get(id); if (g) covered.add(g);
    }
    for (const g of allGroups) expect(covered.has(g), `group "${g}" uncovered`).toBe(true);
  });

  it("only references signal ids that exist in the registry", () => {
    const ids = new Set(SIGNALS.map((s) => s.id));
    for (const v of BUILTIN_VARIANTS) for (const id of [...(v.signals?.ids ?? []), ...(v.signals?.exclude ?? [])]) {
      expect(ids.has(id), `unknown id "${id}" in ${v.id}`).toBe(true);
    }
  });

  it("has 13 variants with unique ids", () => {
    expect(BUILTIN_VARIANTS).toHaveLength(13);
    expect(new Set(BUILTIN_VARIANTS.map((v) => v.id)).size).toBe(13);
  });
});
