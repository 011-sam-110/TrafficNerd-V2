import { expect, test } from "vitest";
import { findById, nearest, search } from "@/lib/sources/select";
import type { Camera } from "@/lib/types";

const base = {
  source: "tfl",
  country: "GB",
  mediaType: "jpeg" as const,
  refreshSeconds: 300,
  license: "OGL",
  attribution: "Powered by TfL Open Data",
  available: true,
};
const cams: Camera[] = [
  { ...base, id: "tfl:a", name: "Westway", lat: 51.5174, lon: -0.2126 },
  { ...base, id: "tfl:b", name: "Tower Bridge Rd", lat: 51.5055, lon: -0.0754 },
  { ...base, id: "tfl:c", name: "London Eye", lat: 51.5033, lon: -0.1196 },
];

test("findById returns the match or null", () => {
  expect(findById(cams, "tfl:b")?.name).toBe("Tower Bridge Rd");
  expect(findById(cams, "tfl:zzz")).toBeNull();
});

test("nearest sorts by distance and respects limit", () => {
  const out = nearest(cams, 51.5033, -0.1196, 2); // at London Eye
  expect(out).toHaveLength(2);
  expect(out[0].camera.id).toBe("tfl:c"); // itself, 0 km
  expect(out[0].km).toBeCloseTo(0, 3);
  expect(out[1].km).toBeLessThanOrEqual(nearest(cams, 51.5033, -0.1196, 3)[2].km);
});

test("search is case-insensitive substring on name", () => {
  expect(search(cams, "bridge").map((c) => c.id)).toEqual(["tfl:b"]);
  expect(search(cams, "")).toHaveLength(3);
});
