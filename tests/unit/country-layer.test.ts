import { describe, it, expect } from "vitest";
import { flagEmoji } from "@/lib/geo/flag";
import { toCountryLabelFC, buildCountryObject } from "@/lib/geo/country";

describe("flagEmoji", () => {
  it("converts a 2-letter ISO code to its flag emoji", () => {
    expect(flagEmoji("GB")).toBe("🇬🇧");
    expect(flagEmoji("us")).toBe("🇺🇸"); // case-insensitive
    expect(flagEmoji("FR")).toBe("🇫🇷");
  });

  it("returns empty string for invalid / disputed codes", () => {
    expect(flagEmoji("-99")).toBe("");
    expect(flagEmoji("")).toBe("");
    expect(flagEmoji(undefined)).toBe("");
    expect(flagEmoji("USA")).toBe(""); // not alpha-2
  });
});

describe("toCountryLabelFC", () => {
  it("emits a point per shipped centroid with name + iso props", () => {
    const fc = toCountryLabelFC();
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThan(150);
    const gb = fc.features.find((f) => f.properties?.iso2 === "GB");
    expect(gb).toBeTruthy();
    expect(gb?.geometry.type).toBe("Point");
    expect(typeof gb?.properties?.name).toBe("string");
  });
});

describe("buildCountryObject", () => {
  it("maps Natural Earth polygon props into a country WorldObject", () => {
    const obj = buildCountryObject(
      { NAME: "France", ISO_A2: "FR", ISO_A3: "FRA", CONTINENT: "Europe", SUBREGION: "Western Europe", POP_EST: 67000000 },
      48.8,
      2.3,
    );
    expect(obj.kind).toBe("country");
    expect(obj.id).toBe("country:FRA");
    expect(obj.label).toBe("France");
    expect(obj.lat).toBe(48.8);
    expect(obj.meta?.flag).toBe("🇫🇷");
    expect(obj.meta?.region).toBe("Western Europe");
    expect(obj.meta?.population).toBe(67000000);
    expect(obj.meta?.placeholder).toBe(true);
  });

  it("falls back through name fields and tolerates -99 / missing props", () => {
    const obj = buildCountryObject({ ADMIN: "Somewhere", ISO_A2: "-99", ISO_A3: "-99" }, 0, 0);
    expect(obj.label).toBe("Somewhere");
    expect(obj.id).toBe("country:Somewhere");
    expect(obj.meta?.flag).toBe("");
    expect(obj.meta?.iso2).toBeUndefined();
  });
});
