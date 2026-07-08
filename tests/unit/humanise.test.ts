import { describe, it, expect } from "vitest";
import { humaniseKey } from "@/lib/text/humanise";

describe("humaniseKey", () => {
  it("camelCase → Title", () => expect(humaniseKey("forecastFor")).toBe("Forecast for"));
  it("snake/kebab → Title", () => {
    expect(humaniseKey("alert_level")).toBe("Alert level");
    expect(humaniseKey("wind-speed")).toBe("Wind speed");
  });
});
