import { expect, test } from "vitest";
import { normalizePorts } from "@/lib/signals/ports";
import { MAJOR_PORTS } from "@/lib/signals/ports.data";

test("normalizes the curated major-ports list to namespaced point features", () => {
  const out = normalizePorts(MAJOR_PORTS);
  expect(out.length).toBe(MAJOR_PORTS.length);
  expect(out.length).toBeGreaterThan(60);
  expect(out.every((f) => f.signalId === "ports")).toBe(true);
  expect(out.every((f) => f.geometry === undefined)).toBe(true); // points only

  const shanghai = out.find((f) => f.title === "Shanghai");
  expect(shanghai?.id).toBe("port:shanghai");
  expect(shanghai?.props?.country).toBe("CN");
  expect(shanghai?.lat).toBeCloseTo(31.23, 2);
});

test("drops records with out-of-range coordinates", () => {
  const out = normalizePorts([
    { name: "Good", country: "XX", lat: 10, lon: 20 },
    { name: "Bad", country: "XX", lat: 200, lon: 20 },
  ]);
  expect(out).toHaveLength(1);
  expect(out[0].title).toBe("Good");
});

test("port ids are unique", () => {
  const out = normalizePorts(MAJOR_PORTS);
  expect(new Set(out.map((f) => f.id)).size).toBe(out.length);
});
