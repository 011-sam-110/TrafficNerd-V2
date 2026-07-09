import { describe, expect, test } from "vitest";
import { parseGeolocateResponse, toResolvedCandidate } from "@/lib/geolocate/response";

describe("toResolvedCandidate", () => {
  test("maps a valid row and clamps a percentage confidence", () => {
    const c = toResolvedCandidate({
      place: "Shibuya, Tokyo",
      country: "Japan",
      lat: 35.6595,
      lon: 139.7005,
      confidence: 78,
      reasoning: "Japanese signage",
    });
    expect(c).not.toBeNull();
    expect(c!.place).toBe("Shibuya, Tokyo");
    expect(c!.country).toBe("Japan");
    expect(c!.lat).toBeCloseTo(35.6595);
    expect(c!.confidence).toBeCloseTo(0.78);
    expect(c!.reasoning).toBe("Japanese signage");
  });

  test("defaults a missing place to empty string and drops empty extras", () => {
    const c = toResolvedCandidate({ lat: 0, lon: 0, confidence: 0.2, country: "  ", reasoning: "" });
    expect(c!.place).toBe("");
    expect(c!.country).toBeUndefined();
    expect(c!.reasoning).toBeUndefined();
  });

  test("returns null for out-of-range or missing coordinates", () => {
    expect(toResolvedCandidate({ place: "X", lat: 999, lon: 5, confidence: 0.3 })).toBeNull();
    expect(toResolvedCandidate({ place: "X", confidence: 0.3 })).toBeNull();
    expect(toResolvedCandidate(null)).toBeNull();
    expect(toResolvedCandidate("nope")).toBeNull();
  });
});

describe("parseGeolocateResponse", () => {
  test("parses a well-formed body, keeping only plottable candidates", () => {
    const out = parseGeolocateResponse({
      method: "geo-model",
      note: "Estimated location — not a measurement.",
      candidates: [
        { place: "Paris", lat: 48.85, lon: 2.35, confidence: 0.9 },
        { place: "Broken", lat: 200, lon: 2, confidence: 0.4 },
      ],
    });
    expect(out.method).toBe("geo-model");
    expect(out.note).toContain("Estimated");
    expect(out.candidates.map((c) => c.place)).toEqual(["Paris"]);
  });

  test("falls back to vision-ai for an unknown/absent method", () => {
    expect(parseGeolocateResponse({ candidates: [] }).method).toBe("vision-ai");
    expect(parseGeolocateResponse({ method: "bogus", candidates: [] }).method).toBe("vision-ai");
  });

  test("passes an error message through and yields no candidates", () => {
    const out = parseGeolocateResponse({ candidates: [], method: "vision-ai", error: "No backend is configured." });
    expect(out.error).toBe("No backend is configured.");
    expect(out.candidates).toEqual([]);
  });

  test("tolerates a non-object / empty / junk body without throwing", () => {
    for (const junk of [null, undefined, "<html>502</html>", 42, [], { candidates: "nope" }]) {
      const out = parseGeolocateResponse(junk);
      expect(out.candidates).toEqual([]);
      expect(out.method).toBe("vision-ai");
      expect(out.error).toBeUndefined();
    }
  });
});
