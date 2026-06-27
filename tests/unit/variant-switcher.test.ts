import { describe, it, expect } from "vitest";
import VariantSwitcher from "@/components/shell/VariantSwitcher";
import { BUILTIN_VARIANTS } from "@/lib/variants/builtins";

describe("VariantSwitcher", () => {
  it("imports as a component and has every built-in variant to render", () => {
    expect(typeof VariantSwitcher).toBe("function");
    expect(BUILTIN_VARIANTS.length).toBe(13);
  });
});
