import { expect, test } from "vitest";
import type { WorldObject } from "@/lib/world";
import { toSignalFC, toSignalLineFC, toSignalFillFC } from "@/lib/map/features";

// The framework's geometry split: one union of signal WorldObjects fans out into
// three GeoJSON sources by geometry kind, so points / lines / areas never collide.
const objs: WorldObject[] = [
  // a plain point signal (earthquake-like)
  { kind: "signal", id: "p1", lat: 1, lon: 2, label: "Point A", color: "#111", meta: { signalId: "earthquakes", props: { magnitude: 5 } } },
  // a line signal (cable)
  {
    kind: "signal", id: "l1", lat: 0, lon: 0, label: "Cable A", color: "#0d9488",
    meta: { signalId: "cables", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } },
  },
  // an area signal (jamming hex)
  {
    kind: "signal", id: "a1", lat: 5, lon: 5, label: "Jam A", color: "#dc2626",
    meta: { signalId: "gpsJamming", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
  },
];

test("toSignalFC keeps ONLY point signals (lines/areas excluded)", () => {
  const fc = toSignalFC(objs);
  expect(fc.features).toHaveLength(1);
  const f = fc.features[0];
  expect(f.geometry.type).toBe("Point");
  expect((f.properties as { id: string }).id).toBe("p1");
  // magnitude 5 → radius 4 + 5*1.6 = 12
  expect((f.properties as { radius: number }).radius).toBeCloseTo(12, 5);
});

test("toSignalLineFC emits only line geometries, passed through with props", () => {
  const fc = toSignalLineFC(objs);
  expect(fc.features).toHaveLength(1);
  const f = fc.features[0];
  expect(f.geometry.type).toBe("LineString");
  expect((f.properties as { id: string; color: string }).id).toBe("l1");
  expect((f.properties as { color: string }).color).toBe("#0d9488");
});

test("toSignalFillFC emits only polygon geometries", () => {
  const fc = toSignalFillFC(objs);
  expect(fc.features).toHaveLength(1);
  const f = fc.features[0];
  expect(f.geometry.type).toBe("Polygon");
  expect((f.properties as { id: string }).id).toBe("a1");
});

test("each builder ignores the other kinds entirely (no leakage)", () => {
  expect(toSignalFC(objs).features.every((f) => f.geometry.type === "Point")).toBe(true);
  expect(toSignalLineFC(objs).features.every((f) => f.geometry.type === "LineString")).toBe(true);
  expect(toSignalFillFC(objs).features.every((f) => f.geometry.type === "Polygon")).toBe(true);
});
