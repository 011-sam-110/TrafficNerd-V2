import { expect, test, describe } from "vitest";
import {
  clampConfidence,
  isValidCoord,
  extractJson,
  normalizeCandidates,
  parseLlmResponse,
  normalizeGeoclip,
} from "@/lib/geolocate/normalize";
import { imageFromBase64, base64ByteLength, toImageUrlValue } from "@/lib/geolocate/image";

describe("clampConfidence", () => {
  test("passes through a 0..1 float", () => {
    expect(clampConfidence(0.42)).toBeCloseTo(0.42);
  });
  test("treats >1 as a percentage", () => {
    expect(clampConfidence(87)).toBeCloseTo(0.87);
    expect(clampConfidence(100)).toBe(1);
  });
  test("parses percent strings", () => {
    expect(clampConfidence("73%")).toBeCloseTo(0.73);
    expect(clampConfidence("0.5")).toBeCloseTo(0.5);
  });
  test("clamps and defaults garbage to 0", () => {
    expect(clampConfidence(-3)).toBe(0);
    expect(clampConfidence(250)).toBe(1);
    expect(clampConfidence(null)).toBe(0);
    expect(clampConfidence("nope")).toBe(0);
  });
});

describe("isValidCoord", () => {
  test("accepts in-range pairs only", () => {
    expect(isValidCoord(51.5, -0.12)).toBe(true);
    expect(isValidCoord(0, 0)).toBe(true);
    expect(isValidCoord(95, 0)).toBe(false);
    expect(isValidCoord(0, 200)).toBe(false);
    expect(isValidCoord(NaN, 0)).toBe(false);
    expect(isValidCoord("51" as unknown, 0)).toBe(false);
  });
});

describe("extractJson", () => {
  test("parses a clean object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  test("strips ```json fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  test("ignores surrounding prose", () => {
    expect(extractJson('Here is my best guess:\n{"candidates":[]} — hope that helps')).toEqual({
      candidates: [],
    });
  });
  test("handles braces inside strings", () => {
    expect(extractJson('{"note":"a } not the end","x":2}')).toEqual({ note: "a } not the end", x: 2 });
  });
  test("returns null on junk", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("")).toBeNull();
  });
});

describe("normalizeCandidates", () => {
  test("sorts by confidence desc and caps at limit", () => {
    const out = normalizeCandidates(
      {
        candidates: [
          { place: "A", lat: 1, lon: 1, confidence: 0.2 },
          { place: "B", lat: 2, lon: 2, confidence: 0.9 },
          { place: "C", lat: 3, lon: 3, confidence: 0.5 },
        ],
      },
      { limit: 2 },
    );
    expect(out.map((c) => c.place)).toEqual(["B", "C"]);
  });

  test("keeps a named place with no coords (lat/lon null for later geocoding)", () => {
    const out = normalizeCandidates([{ place: "Kyoto, Japan", confidence: 0.6 }]);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBeNull();
    expect(out[0].lon).toBeNull();
    expect(out[0].place).toBe("Kyoto, Japan");
  });

  test("nulls out-of-range coords but keeps the place", () => {
    const out = normalizeCandidates([{ place: "X", lat: 999, lon: 5, confidence: 0.3 }]);
    expect(out[0].lat).toBeNull();
  });

  test("drops rows with neither place nor coords", () => {
    const out = normalizeCandidates([{ confidence: 0.9 }, { place: "Keep", confidence: 0.1 }]);
    expect(out.map((c) => c.place)).toEqual(["Keep"]);
  });

  test("reads alias keys (name/latitude/longitude/score) and normalises percent", () => {
    const out = normalizeCandidates([
      { name: "Berlin", latitude: 52.52, longitude: 13.405, score: 64 },
    ]);
    expect(out[0].place).toBe("Berlin");
    expect(out[0].lat).toBeCloseTo(52.52);
    expect(out[0].lon).toBeCloseTo(13.405);
    expect(out[0].confidence).toBeCloseTo(0.64);
  });

  test("tolerates non-array / null input", () => {
    expect(normalizeCandidates(null)).toEqual([]);
    expect(normalizeCandidates({ candidates: "nope" })).toEqual([]);
  });
});

describe("parseLlmResponse (end to end)", () => {
  test("parses a fenced, prose-wrapped completion", () => {
    const raw =
      "I think this is the place.\n```json\n" +
      '{"candidates":[{"place":"Shibuya, Tokyo","country":"Japan","lat":35.6595,"lon":139.7005,"confidence":0.78,"reasoning":"signage in Japanese"}]}' +
      "\n```\nLet me know!";
    const out = parseLlmResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].place).toBe("Shibuya, Tokyo");
    expect(out[0].country).toBe("Japan");
    expect(out[0].confidence).toBeCloseTo(0.78);
    expect(out[0].reasoning).toContain("Japanese");
  });

  test("accepts a bare array completion", () => {
    const out = parseLlmResponse('[{"place":"Paris","lat":48.85,"lon":2.35,"confidence":0.9}]');
    expect(out[0].place).toBe("Paris");
  });

  test("returns [] when the model produced no JSON", () => {
    expect(parseLlmResponse("I cannot determine the location.")).toEqual([]);
  });
});

describe("normalizeGeoclip", () => {
  test("maps top-k coordinate rows and blanks the place", () => {
    const out = normalizeGeoclip({
      predictions: [
        { lat: 40.4168, lon: -3.7038, confidence: 0.41 },
        { lat: 41.0, lon: 2.0, score: 0.2 },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].place).toBe("");
    expect(out[0].lat).toBeCloseTo(40.4168);
    expect(out[0].confidence).toBeCloseTo(0.41);
  });

  test("drops rows without valid coords", () => {
    const out = normalizeGeoclip([{ lat: 999, lon: 0, confidence: 0.9 }]);
    expect(out).toEqual([]);
  });
});

describe("image helpers", () => {
  test("base64ByteLength approximates decoded size", () => {
    const b64 = Buffer.from("hello world").toString("base64");
    expect(base64ByteLength(b64)).toBe(11);
    expect(base64ByteLength(`data:image/png;base64,${b64}`)).toBe(11);
  });

  test("imageFromBase64 accepts raw base64 and data URLs", () => {
    const b64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64");
    const img = imageFromBase64(b64);
    expect(img).not.toBeNull();
    expect(img!.kind).toBe("data");
    expect(toImageUrlValue(img!)).toMatch(/^data:image\/jpeg;base64,/);

    const withMime = imageFromBase64(`data:image/png;base64,${b64}`);
    expect(toImageUrlValue(withMime!)).toMatch(/^data:image\/png;base64,/);
  });

  test("imageFromBase64 rejects non-base64 junk", () => {
    expect(imageFromBase64("!!!not base64!!!")).toBeNull();
    expect(imageFromBase64("")).toBeNull();
  });
});
