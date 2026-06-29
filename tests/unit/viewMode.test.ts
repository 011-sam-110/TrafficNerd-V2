// tests/unit/viewMode.test.ts
import { describe, it, expect } from "vitest";
import { coerceViewMode, DEFAULT_VIEW_MODE } from "@/lib/shell/viewMode";

describe("coerceViewMode", () => {
  it("defaults to console", () => {
    expect(DEFAULT_VIEW_MODE).toBe("console");
    expect(coerceViewMode(null)).toBe("console");
    expect(coerceViewMode("nonsense")).toBe("console");
  });
  it("keeps a valid saved mode", () => {
    expect(coerceViewMode("explore")).toBe("explore");
    expect(coerceViewMode("console")).toBe("console");
  });
});
