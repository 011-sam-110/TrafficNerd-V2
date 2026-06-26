import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/tfl-place.json";
import { normalizeTfl, type TflPlace } from "@/lib/sources/tfl";

// Data audit guard for pin accuracy: TfL coordinates are authoritative, so
// normalizeTfl must pass lat/lon through verbatim — no transposition, sign
// flip, or constant offset. If a future change swaps lat/lon, this fails.
test("normalizeTfl preserves TfL lat/lon verbatim", () => {
  const places = fixture as TflPlace[];
  const cams = normalizeTfl(places);
  cams.forEach((c, i) => {
    expect(c.lat).toBe(places[i].lat);
    expect(c.lon).toBe(places[i].lon);
  });
});

test("normalized London cameras land in the expected lat/lon quadrant", () => {
  const [first] = normalizeTfl(fixture as TflPlace[]);
  // London: lat ~+51.5 (clearly positive ~51), lon ~ -0.2 (small negative).
  // A lat/lon swap would put lat near -0.2 and lon near +51 — caught here.
  expect(first.lat).toBeGreaterThan(50);
  expect(first.lat).toBeLessThan(52);
  expect(first.lon).toBeGreaterThan(-1);
  expect(first.lon).toBeLessThan(0);
});
