import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/tfl-place.json";
import { normalizeTfl, type TflPlace } from "@/lib/sources/tfl";
import { CameraArray } from "@/lib/types";

test("normalizes TfL places into valid Cameras", () => {
  const cams = normalizeTfl(fixture as TflPlace[]);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(3);
});

test("maps id, coords, attribution and availability", () => {
  const [first, , offline] = normalizeTfl(fixture as TflPlace[]);
  expect(first.id).toBe("tfl:JamCams_00001.07450");
  expect(first.source).toBe("tfl");
  expect(first.country).toBe("GB");
  expect(first.name).toBe("A40 Westway/Woodger Rd");
  expect(first.imageUrl).toContain("00001.07450.jpg");
  expect(first.mediaType).toBe("both"); // has videoUrl
  expect(first.attribution).toBe("Powered by TfL Open Data");
  expect(first.refreshSeconds).toBe(300);
  expect(offline.available).toBe(false);
});
