// tests/unit/event-metrics.test.ts
import { describe, it, expect } from "vitest";
import { eventMetricLine } from "@/lib/widgets/eventMetrics";

describe("eventMetricLine", () => {
  it("quake: magnitude + depth", () => {
    expect(eventMetricLine("quake", { magnitude: 5.2, depth: "12.3 km" })).toBe("M 5.2 · depth 12.3 km");
  });
  it("cyclone: category + wind + pressure + movement", () => {
    expect(eventMetricLine("cyclone", { category: "Cat 3 hurricane", maxWind: "90 kt", pressure: "960 mb", movement: "315° at 12 kt" }))
      .toBe("Cat 3 hurricane · 90 kt · 960 mb · moving 315° at 12 kt");
  });
  it("disaster: alert level + country + ongoing (no fake magnitude)", () => {
    expect(eventMetricLine("disaster", { alertLevel: "Red", country: "Nigeria", ongoing: "yes" }))
      .toBe("Red alert · Nigeria · ongoing");
  });
  it("returns empty string when nothing usable is present", () => {
    expect(eventMetricLine("other", undefined)).toBe("");
    expect(eventMetricLine("disaster", {})).toBe("");
  });
});
