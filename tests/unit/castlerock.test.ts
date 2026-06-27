import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/castlerock.json";
import {
  normalizeCastleRock,
  parseWktPoint,
  pageStarts,
  CASTLEROCK_SYSTEMS,
} from "@/lib/sources/castlerock";
import { CameraArray } from "@/lib/types";

const FL = CASTLEROCK_SYSTEMS.find((s) => s.system === "fl")!;
const ON = CASTLEROCK_SYSTEMS.find((s) => s.system === "on")!;

test("parseWktPoint reads 'POINT (lon lat)' as longitude-first", () => {
  const pt = parseWktPoint("POINT (-80.892882 26.17325)");
  expect(pt).not.toBeNull();
  expect(pt!.lon).toBeCloseTo(-80.892882, 5);
  expect(pt!.lat).toBeCloseTo(26.17325, 5);
  expect(parseWktPoint("not wkt")).toBeNull();
  expect(parseWktPoint(null)).toBeNull();
});

test("normalizes Castle Rock records, skipping null-geometry and image-less ones", () => {
  const cams = normalizeCastleRock(fixture as never, FL);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(2); // id 99 (null latLng) + id 100 (no images) are skipped
});

test("maps namespaced id, region, road, snapshot URL, media type and availability", () => {
  const [a, b] = normalizeCastleRock(fixture as never, FL);
  expect(a.id).toBe("castlerock:fl:1");
  expect(a.source).toBe("castlerock");
  expect(a.country).toBe("US");
  expect(a.region).toBe("Florida");
  expect(a.road).toBe("I-75");
  expect(a.direction).toBe("Northbound");
  expect(a.imageUrl).toBe("https://fl511.com/map/Cctv/1");
  expect(a.mediaType).toBe("jpeg"); // auth-gated video is intentionally dropped
  expect(a.available).toBe(true);
  expect(b.id).toBe("castlerock:fl:3");
  expect(b.available).toBe(false); // image is blocked
});

test("attribution is present and credits the operating agency", () => {
  const [a] = normalizeCastleRock(fixture as never, FL);
  expect(a.attribution.length).toBeGreaterThan(0);
  expect(a.attribution).toContain("Florida");
  expect(a.license.length).toBeGreaterThan(0);
});

// The load-bearing assertion: WKT is lon-first, so a correct adapter must place
// 26.17 in `lat` and -80.89 in `lon`. If the two were swapped, `lat` would be
// -80.89 (still a *valid* latitude, so the zod schema would NOT catch it) and
// `lon` would be +26.17 — both of the assertions below would then fail.
test("assigns lat/lon in the correct order (fails loudly if swapped)", () => {
  const [a] = normalizeCastleRock(fixture as never, FL);
  expect(a.lat).toBeCloseTo(26.17325, 4);
  expect(a.lon).toBeCloseTo(-80.892882, 4);
  // Florida is in the northern, western hemisphere: a swap would invert both signs.
  expect(a.lat).toBeGreaterThan(0);
  expect(a.lon).toBeLessThan(0);
});

test("the same record set re-namespaces and re-flags country per system", () => {
  const [a] = normalizeCastleRock(fixture as never, ON);
  expect(a.id).toBe("castlerock:on:1"); // namespace switches with the system
  expect(a.country).toBe("CA"); // Canadian systems map to CA, US systems to US
  expect(a.imageUrl).toBe("https://511on.ca/map/Cctv/1"); // snapshot host follows the site
});
