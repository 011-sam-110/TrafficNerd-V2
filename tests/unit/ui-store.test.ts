import { describe, it, expect } from "vitest";
import { uiStore } from "@/lib/shell/ui";

describe("uiStore (theme only)", () => {
  it("no longer exposes railOpen / newsTicker", () => {
    expect("railOpen" in uiStore.get()).toBe(false);
    expect("newsTicker" in uiStore.get()).toBe(false);
    expect((uiStore as Record<string, unknown>).toggleRail).toBeUndefined();
  });
  it("toggles theme", () => {
    uiStore.setTheme("light");
    uiStore.toggleTheme();
    expect(uiStore.get().theme).toBe("dark");
  });
});
