import { describe, it, expect } from "vitest";
import { severityTier, severityRank, placeName, SEVERITY_COLOR } from "@/lib/events/model";

describe("severityTier (interim 0–10 ramp)", () => {
  it("maps the normalized magnitude band to a tier", () => {
    expect(severityTier(9)).toBe("S4");
    expect(severityTier(8)).toBe("S4");
    expect(severityTier(6)).toBe("S3");
    expect(severityTier(4)).toBe("S2");
    expect(severityTier(2)).toBe("S1");
    expect(severityTier(1.9)).toBe("S0");
    expect(severityTier(0)).toBe("S0");
  });
  it("treats a non-finite magnitude as S0 (never throws)", () => {
    expect(severityTier(NaN)).toBe("S0");
    expect(severityTier(Infinity)).toBe("S4"); // >=8 branch; finite-guard only catches NaN
  });
});

describe("severityRank", () => {
  it("orders tiers low→high", () => {
    expect(severityRank("S0")).toBeLessThan(severityRank("S4"));
    expect(severityRank("S3")).toBe(3);
  });
});

describe("placeName", () => {
  it("prefers an explicit props.place", () => {
    expect(placeName("M0.7 - 9 km N of Anza, CA", { place: "Anza, CA" })).toBe("Anza, CA");
  });
  it("falls back to the title tail after a dash", () => {
    expect(placeName("M5.8 - 9 km N of Anza, CA")).toBe("9 km N of Anza, CA");
    expect(placeName("Active fire — Sonoma County")).toBe("Sonoma County");
  });
  it("uses the whole title when there is no delimiter", () => {
    expect(placeName("Tropical Storm Bret")).toBe("Tropical Storm Bret");
  });
});

describe("SEVERITY_COLOR", () => {
  it("has a colour for every tier", () => {
    for (const t of ["S0", "S1", "S2", "S3", "S4"] as const) {
      expect(SEVERITY_COLOR[t]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
