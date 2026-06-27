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
