import { expect, test } from "vitest";
// Live-captured AISStream PositionReports (chokepoint boxes), plus one null-coord edge row.
import fixture from "@/tests/fixtures/ais-vessels.json";
import { normalizeAis, navStatusLabel } from "@/lib/signals/ais";

test("normalizes AIS vessels, skipping rows with no position", () => {
  const out = normalizeAis(fixture as never);
  expect(out).toHaveLength(6); // 6 located vessels; the MMSI=0 / null-coord row is skipped
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["ais"]));

  const maersk = out.find((f) => f.id === "ais:219179000")!;
  expect(maersk.title).toBe("MAERSK TRIESTE");
  expect(maersk.lat).toBeCloseTo(50.42163);
  expect(maersk.lon).toBeCloseTo(-0.46898);
  expect(maersk.props?.speed).toBe("13.5 kt");
  expect(maersk.props?.course).toBe("259°");
  expect(maersk.props?.status).toBe("under way (engine)");
  expect(maersk.color).toBe("#0d9488"); // moving → teal
  expect(maersk.ts).toBe("2026-06-27T09:24:09.000Z");
});

test("stationary vessels render slate; moving render teal", () => {
  const out = normalizeAis(fixture as never);
  const anchored = out.find((f) => f.id === "ais:271002308")!; // SINAN PASA, Sog 0
  expect(anchored.color).toBe("#64748b");
  expect(anchored.props?.speed).toBe("0.0 kt");

  const moving = out.find((f) => f.id === "ais:538011030")!; // FIYUH, Sog 5
  expect(moving.color).toBe("#0d9488");
});

test("nav-status codes map to human labels", () => {
  expect(navStatusLabel(0)).toBe("under way (engine)");
  expect(navStatusLabel(1)).toBe("at anchor");
  expect(navStatusLabel(5)).toBe("moored");
  expect(navStatusLabel(99)).toBe("—");
  expect(navStatusLabel(null)).toBe("—");
});
