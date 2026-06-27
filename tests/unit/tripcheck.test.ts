import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/tripcheck.json";
import { normalizeTripCheck } from "@/lib/sources/tripcheck";
import { CameraArray } from "@/lib/types";

test("normalizes TripCheck inventory, skipping no-coords / empty-filename / null-island", () => {
  const cams = normalizeTripCheck(fixture as never);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(4); // 3 edge-case features dropped
});

test("uses the WGS84 latitude/longitude attrs, NOT the wkid:3857 mercator geometry", () => {
  const cams = normalizeTripCheck(fixture as never);
  // If a buggy adapter read geometry.x/y (metres, ~1e7) every lat/lon would be
  // wildly out of range. Assert they all sit in a plausible Oregon box.
  for (const c of cams) {
    expect(c.lat).toBeGreaterThan(41);
    expect(c.lat).toBeLessThan(47);
    expect(c.lon).toBeGreaterThan(-125);
    expect(c.lon).toBeLessThan(-116);
  }
  const astoria = cams.find((c) => c.id === "tripcheck:277")!;
  expect(astoria.lat).toBeCloseTo(46.18785, 4);
  expect(astoria.lon).toBeCloseTo(-123.85347, 4);
});

test("maps id, country/region, road, image URL and media type", () => {
  const cams = normalizeTripCheck(fixture as never);
  const astoria = cams.find((c) => c.id === "tripcheck:277")!;
  expect(astoria.source).toBe("tripcheck");
  expect(astoria.country).toBe("US");
  expect(astoria.region).toBe("Oregon");
  expect(astoria.name).toBe("US101 at Astoria - ODOT District Office");
  expect(astoria.road).toBe("US101"); // trailing space trimmed
  expect(astoria.imageUrl).toBe(
    "https://tripcheck.com/RoadCams/cams/AstoriaUS101MeglerBrNB_pid392.jpg",
  );
  expect(astoria.mediaType).toBe("jpeg");
  expect(astoria.available).toBe(true);
});

test("percent-encodes spaces in filenames but preserves @, and ids are namespaced", () => {
  const cams = normalizeTripCheck(fixture as never);
  const snake = cams.find((c) => c.id === "tripcheck:211")!;
  expect(snake.imageUrl).toBe("https://tripcheck.com/RoadCams/cams/Snake%20River_pid654.JPG");
  const at = cams.find((c) => c.id === "tripcheck:379")!;
  expect(at.imageUrl).toBe("https://tripcheck.com/RoadCams/cams/i84@257th_pid1583.JPG");
  for (const c of cams) {
    expect(c.id).toMatch(/^tripcheck:/);
    expect(c.attribution.length).toBeGreaterThan(0);
    expect(c.license.length).toBeGreaterThan(0);
  }
});
