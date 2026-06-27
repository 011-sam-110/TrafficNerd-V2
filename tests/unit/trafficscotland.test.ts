import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/scotland.json";
import { normalizeTrafficScotland, extractScotlandImage } from "@/lib/sources/trafficscotland";
import { CameraArray } from "@/lib/types";

test("normalizes the Traffic Scotland list, skipping rows with a blank coordinate", () => {
  const cams = normalizeTrafficScotland(fixture as never);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  // 3 rows have coords; the synthetic id 99999 has lat:"" (which Number() would
  // turn into 0, NOT NaN) → must be skipped by the blank-string guard.
  expect(cams).toHaveLength(3);
  for (const c of cams) {
    expect(c.id.startsWith("trafficscotland:")).toBe(true);
    expect(c.source).toBe("trafficscotland");
    expect(c.country).toBe("GB");
    expect(c.mediaType).toBe("jpeg");
    // Scotland's real bounding box.
    expect(c.lat).toBeGreaterThan(54);
    expect(c.lat).toBeLessThan(61);
    expect(c.lon).toBeGreaterThan(-8);
    expect(c.lon).toBeLessThan(-1);
  }
});

test("parses string coords and points imageUrl at the per-camera HTML page", () => {
  const cams = normalizeTrafficScotland(fixture as never);
  const c = cams.find((x) => x.id === "trafficscotland:1")!;
  expect(c).toBeTruthy();
  expect(c.name).toBe("M8 Kingston Br");
  expect(c.region).toBe("Strathclyde");
  expect(c.road).toBe("M8");
  expect(c.lat).toBeCloseTo(55.852826, 5);
  expect(c.lon).toBeCloseTo(-4.2708061, 5);
  // The image is a base64 JPEG inside the camerahtml page; the proxy resolves it.
  expect(c.imageUrl).toBe("https://www.traffic.gov.scot/tsis/camerahtml?sid=1");
});

test("extractScotlandImage pulls the base64 JPEG out of the camera HTML", () => {
  const html =
    '<html><body><img src="/themes/logo.png"/>' +
    '<img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD="/>' +
    "</body></html>";
  const img = extractScotlandImage(html);
  expect(img).not.toBeNull();
  expect(img!.contentType).toBe("image/jpeg");
  expect(img!.base64).toBe("/9j/4AAQSkZJRgABAgAAAQABAAD=");
});

test("extractScotlandImage returns null when no embedded image is present", () => {
  expect(extractScotlandImage("<html><body>no image here</body></html>")).toBeNull();
});
