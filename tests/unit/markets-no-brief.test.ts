import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("DailyBrief extraction", () => {
  it("MarketsPanel no longer imports or renders DailyBrief", () => {
    const src = readFileSync("components/shell/MarketsPanel.tsx", "utf8");
    expect(src).not.toMatch(/DailyBrief/);
  });
});
