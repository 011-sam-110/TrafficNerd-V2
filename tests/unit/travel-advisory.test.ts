import { expect, test, describe } from "vitest";
import { parseAdvisory, advisoryBand, type AdvisoryPayload } from "@/lib/geo/travelAdvisory";

const payload: AdvisoryPayload = {
  data: {
    US: {
      iso_alpha2: "US",
      name: "United States",
      advisory: {
        score: 2.7,
        message: "Exercise increased caution.",
        updated: "2024-11-02 10:00:00",
        source: "https://www.travel-advisory.info/united-states",
      },
    },
    SY: {
      iso_alpha2: "SY",
      name: "Syria",
      advisory: { score: 4.9, message: "Do not travel.", updated: "2024-10-01 00:00:00", source: "" },
    },
    IS: {
      iso_alpha2: "IS",
      name: "Iceland",
      advisory: { score: 0.8, message: "Take normal precautions.", updated: "2024-09-01", source: "https://x" },
    },
    XX: { iso_alpha2: "XX", name: "Nowhere" }, // no advisory
  },
};

describe("parseAdvisory", () => {
  test("shapes a country's aggregate advisory with band + colour", () => {
    const v = parseAdvisory(payload, "US")!;
    expect(v.name).toBe("United States");
    expect(v.score).toBe(2.7);
    expect(v.band).toBe("moderate");
    expect(v.label).toBe("Moderate risk");
    expect(v.updated).toBe("2024-11-02");
    expect(v.source).toBe("https://www.travel-advisory.info/united-states");
  });

  test("is case-insensitive on the ISO code", () => {
    expect(parseAdvisory(payload, "us")?.score).toBe(2.7);
  });

  test("bands a very high score red and a low score green", () => {
    expect(parseAdvisory(payload, "SY")?.band).toBe("high");
    expect(parseAdvisory(payload, "IS")?.band).toBe("low");
  });

  test("falls back to the aggregator home when a row omits its source URL", () => {
    expect(parseAdvisory(payload, "SY")?.source).toBe("https://www.travel-advisory.info/");
  });

  test("returns null for missing country, missing advisory, or a bad code", () => {
    expect(parseAdvisory(payload, "DE")).toBeNull();
    expect(parseAdvisory(payload, "XX")).toBeNull();
    expect(parseAdvisory(payload, "")).toBeNull();
    expect(parseAdvisory(payload, "USA")).toBeNull();
  });
});

test("advisoryBand thresholds", () => {
  expect(advisoryBand(0).band).toBe("low");
  expect(advisoryBand(2.49).band).toBe("low");
  expect(advisoryBand(2.5).band).toBe("moderate");
  expect(advisoryBand(3.49).band).toBe("moderate");
  expect(advisoryBand(3.5).band).toBe("high");
  expect(advisoryBand(5).band).toBe("high");
});
