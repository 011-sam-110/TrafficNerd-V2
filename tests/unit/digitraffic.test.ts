import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/digitraffic-stations.json";
import { normalizeDigitraffic } from "@/lib/sources/digitraffic";
import { CameraArray } from "@/lib/types";

test("normalizes Digitraffic stations, skipping null-geometry and preset-less ones", () => {
  const cams = normalizeDigitraffic(fixture as never);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(2); // C00000 (null geom) + C11111 (no presets) skipped
});

test("builds the image URL from the active preset; maps region + availability", () => {
  const [a, b] = normalizeDigitraffic(fixture as never);
  expect(a.id).toBe("digitraffic:C01503");
  expect(a.country).toBe("FI");
  expect(a.region).toBe("Finland");
  expect(a.name).toBe("kt51_Inkoo");
  // First in-collection preset is C0150302 (not the first listed).
  expect(a.imageUrl).toBe("https://weathercam.digitraffic.fi/C0150302.jpg");
  expect(a.mediaType).toBe("jpeg");
  expect(a.available).toBe(true); // GATHERING
  expect(b.available).toBe(false); // REMOVED_TEMPORARILY
  expect(b.imageUrl).toBe("https://weathercam.digitraffic.fi/C9999901.jpg");
});
