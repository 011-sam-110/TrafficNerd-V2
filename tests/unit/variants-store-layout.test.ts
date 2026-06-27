import { describe, it, expect, beforeEach } from "vitest";
import { variantStore } from "@/lib/variants/store";
import { BUILTIN_BY_ID } from "@/lib/variants/builtins";

describe("variantStore layout overrides", () => {
  beforeEach(() => {
    variantStore.resetLayout("markets");
  });

  it("falls back to the variant's own panels when no override", () => {
    expect(variantStore.layoutForVariant("markets")).toEqual(BUILTIN_BY_ID["markets"].panels);
  });

  it("commitLayout stores + layoutForVariant returns it; resetLayout clears", () => {
    const custom = BUILTIN_BY_ID["markets"].panels.map((p) => ({ ...p, grid: { ...p.grid, x: 1 } }));
    variantStore.commitLayout("markets", custom);
    expect(variantStore.layoutForVariant("markets")).toEqual(custom);
    variantStore.resetLayout("markets");
    expect(variantStore.layoutForVariant("markets")).toEqual(BUILTIN_BY_ID["markets"].panels);
  });
});
