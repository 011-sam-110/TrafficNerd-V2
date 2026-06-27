import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseAirportsCsv, parseCsv } from "@/lib/signals/airports";

const csv = readFileSync("tests/fixtures/airports.csv", "utf8");

test("CSV parser handles quoted fields containing commas", () => {
  const rows = parseCsv(csv);
  // Row 1 (KSFO) name has an embedded comma inside quotes.
  expect(rows[1][3]).toBe("San Francisco International Airport, Bay");
});

test("keeps only large_airport rows (drops small_airport + heliport)", () => {
  const out = parseAirportsCsv(csv);
  // KSFO, EGLL, NOIA are large_airport; the small_airport + heliport are dropped.
  expect(out).toHaveLength(3);
  expect(out.every((f) => f.signalId === "airports")).toBe(true);
  expect(out.some((f) => f.title.includes("Tiny Strip"))).toBe(false);
});

test("maps ident, iata, country and city; tolerates a missing IATA", () => {
  const out = parseAirportsCsv(csv);
  const sfo = out.find((f) => f.id === "airport:KSFO");
  expect(sfo?.lat).toBeCloseTo(37.619, 3);
  expect(sfo?.lon).toBeCloseTo(-122.375, 3);
  expect(sfo?.props?.iata).toBe("SFO");
  expect(sfo?.props?.country).toBe("US");
  expect(sfo?.props?.city).toBe("San Francisco");

  const noIata = out.find((f) => f.id === "airport:NOIA");
  expect(noIata?.props?.iata).toBeUndefined();
  expect(noIata?.props?.country).toBe("SB");
});
