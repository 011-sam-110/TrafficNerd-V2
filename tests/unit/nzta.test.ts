import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/nzta.json";
import { normalizeNzta } from "@/lib/sources/nzta";
import { CameraArray } from "@/lib/types";

test("normalizes NZTA cameras into valid Camera[], skipping image-less rows", () => {
  const cams = normalizeNzta(fixture as never);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  // 4 rows have coords + imageUrl; the synthetic id 999999 has no imageUrl → skipped.
  expect(cams).toHaveLength(4);
  for (const c of cams) {
    expect(c.id.startsWith("nzta:")).toBe(true);
    expect(c.source).toBe("nzta");
    expect(c.country).toBe("NZ");
    expect(c.mediaType).toBe("jpeg");
    expect(c.attribution.length).toBeGreaterThan(0);
    expect(c.license.length).toBeGreaterThan(0);
    // Every camera should sit inside New Zealand's real bounding box.
    expect(c.lat).toBeGreaterThan(-48);
    expect(c.lat).toBeLessThan(-34);
    expect(c.lon).toBeGreaterThan(166);
    expect(c.lon).toBeLessThan(179);
  }
});

test("uses the camera node's own lat/lon (NOT the journey coords) and prefixes the image origin", () => {
  const cams = normalizeNzta(fixture as never);
  const c = cams.find((x) => x.id === "nzta:714")!;
  expect(c).toBeTruthy();
  expect(c.name).toBe("SH1 Tinwald"); // trailing space trimmed
  // The journey start/end coords are ~ -41.95/174.06 and -44.84/171.08; the camera's
  // OWN coords are -43.919632 / 171.721055. Reading the journey instead would shift it.
  expect(c.lat).toBeCloseTo(-43.919632, 5);
  expect(c.lon).toBeCloseTo(171.721055, 5);
  expect(c.lat).toBeLessThan(0); // southern hemisphere — fails if lat/lon swapped
  expect(c.imageUrl).toBe("https://trafficnz.info/camera/714.jpg");
  expect(c.road).toBe("SH1");
});

test("flags offline / under-maintenance cameras as not available", () => {
  const cams = normalizeNzta(fixture as never);
  const healthy = cams.find((x) => x.id === "nzta:714")!;
  expect(healthy.available).toBe(true);
  // The fixture includes one offline and one under-maintenance camera.
  const down = cams.filter((c) => c.available === false);
  expect(down.length).toBe(2);
});
