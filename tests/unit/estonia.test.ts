import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/estonia.json";
import { normalizeEstonia } from "@/lib/sources/estonia";
import { CameraArray } from "@/lib/types";

test("normalizes Tark Tee ArcGIS features, skipping rows with no image_path", () => {
  const cams = normalizeEstonia(fixture as never);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  // 3 features have an image_path; the synthetic id 99999 has null image_path → skipped.
  expect(cams).toHaveLength(3);
  for (const c of cams) {
    expect(c.id.startsWith("estonia:")).toBe(true);
    expect(c.source).toBe("estonia");
    expect(c.country).toBe("EE");
    expect(c.mediaType).toBe("jpeg");
    // Estonia's real bounding box.
    expect(c.lat).toBeGreaterThan(57);
    expect(c.lat).toBeLessThan(60);
    expect(c.lon).toBeGreaterThan(21);
    expect(c.lon).toBeLessThan(28);
  }
});

test("reads geometry x→lon, y→lat (outSR=4326) and builds the timestamped image URL", () => {
  const cams = normalizeEstonia(fixture as never);
  const c = cams.find((x) => x.id === "estonia:11")!;
  expect(c).toBeTruthy();
  expect(c.name).toBe("Jõhvi");
  expect(c.lon).toBeCloseTo(27.44067, 4); // geometry.x = longitude
  expect(c.lat).toBeCloseTo(59.36536, 4); // geometry.y = latitude
  expect(c.lat).toBeGreaterThan(c.lon); // EE: lat≈59 > lon≈27 — fails if swapped
  expect(c.imageUrl).toBe(
    "https://tarktee.transpordiamet.ee/images/94/94_202606270441.jpg",
  );
});
