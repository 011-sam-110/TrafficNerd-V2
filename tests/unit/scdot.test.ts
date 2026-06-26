import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/scdot-cameras.json";
import { normalizeScdot } from "@/lib/sources/scdot";
import { CameraArray } from "@/lib/types";

test("normalizes SCDOT GeoJSON into valid Cameras and skips geometry-less features", () => {
  const cams = normalizeScdot(fixture as never);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(2); // feature 3 has null geometry
});

test("uses description as name, lon/lat order, and problem_stream → unavailable", () => {
  const [a, b] = normalizeScdot(fixture as never);
  expect(a.id).toBe("scdot:50001");
  expect(a.region).toBe("South Carolina");
  expect(a.name).toBe("US 501 N @ 16th Ave");
  expect(a.lat).toBeCloseTo(33.845627, 5);
  expect(a.lon).toBeCloseTo(-79.062775, 5);
  expect(a.mediaType).toBe("both");
  expect(a.available).toBe(true);
  expect(b.available).toBe(false); // problem_stream: true
});

test("pre-resolves the redirecting thumb URL to the real snapshot path", () => {
  const [a] = normalizeScdot(fixture as never);
  // /thumbs/50001.flv.png 301s to /50001.png — store the resolved form.
  expect(a.imageUrl).toBe("https://scdotsnap.us-east-1.skyvdn.com/50001.png");
});
