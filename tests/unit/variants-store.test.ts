import { describe, it, expect } from "vitest";
import { variantStore, resolveVariant } from "@/lib/variants/store";
import { layersStore } from "@/lib/layers";
import { signalsStore } from "@/lib/signals/store";

// Node env: persist.ts no-ops without window.localStorage, so each bootstrap
// starts from defaults — no reset hook needed.
describe("variantStore", () => {
  it("bootstraps the default explore variant when no URL/persisted state", () => {
    variantStore.bootstrap(new URLSearchParams(""));
    expect(variantStore.get().activeId).toBe("explore");
    expect(layersStore.get().cameras).toBe(true);
    expect(layersStore.get().satellites).toBe(false);
  });
  it("URL v= picks the variant and seeds its signals", () => {
    variantStore.bootstrap(new URLSearchParams("v=cyber"));
    expect(variantStore.get().activeId).toBe("cyber");
    expect(signalsStore.isOn("cyber-c2")).toBe(true);
  });
  it("falls back to explore for an unknown variant id", () => {
    variantStore.bootstrap(new URLSearchParams("v=does-not-exist"));
    expect(variantStore.get().activeId).toBe("explore");
  });
  it("resolveVariant returns a builtin by id", () => {
    expect(resolveVariant("intel").title).toBe("Intel");
  });
});

describe("override capture", () => {
  it("a real user toggle is captured as an override", () => {
    // explore preset has cameras: true — setting it false is a genuine divergence
    variantStore.bootstrap(new URLSearchParams("v=explore"));
    layersStore.set("cameras", false);
    const overrides = variantStore.get().overrides;
    expect(overrides["explore"]).toBeDefined();
    expect(overrides["explore"]!.layers?.cameras).toBe(false);
  });

  it("resetToVariant clears the override and re-seeds the preset", () => {
    // state carries explore + cameras:false override from the previous test
    variantStore.resetToVariant();
    expect(variantStore.get().overrides["explore"]).toBeUndefined();
    expect(layersStore.get().cameras).toBe(true);
  });

  it("an override is preserved per-variant across switching", () => {
    // fresh known state: explore with cameras:true
    variantStore.bootstrap(new URLSearchParams("v=explore"));
    // diverge from explore's cameras:true
    layersStore.set("cameras", false);
    expect(variantStore.get().overrides["explore"]).toBeDefined();
    // switch away to aviation (cameras:false in its preset) then back
    variantStore.setActive("aviation");
    variantStore.setActive("explore");
    // override must survive the round-trip AND be re-applied to the live store
    expect(variantStore.get().overrides["explore"]).toBeDefined();
    expect(variantStore.get().overrides["explore"]!.layers?.cameras).toBe(false);
    expect(layersStore.get().cameras).toBe(false);
  });
});
