import { expect, test } from "vitest";
// Live-captured OpenAQ PM2.5 readings, including real sensor-error rows (-1, -9999, 0)
// and synthetic null-coord / negative-value edge rows.
import fixture from "@/tests/fixtures/openaq-pm25.json";
import { normalizeAirStations, pm25Band } from "@/lib/signals/airquality-stations";

test("plots valid PM2.5 stations and rejects error sentinels", () => {
  const out = normalizeAirStations(fixture as never);
  // Only rows with a real positive value AND valid coordinates survive.
  expect(out.length).toBeGreaterThan(0);
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["air-quality-stations"]));
  // No zero/negative/sentinel readings leak through.
  for (const f of out) {
    const v = parseFloat(String(f.props?.pm25));
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(2000);
    expect(f.lat).toBeGreaterThanOrEqual(-90);
    expect(f.lat).toBeLessThanOrEqual(90);
  }
  // The null-coord row and the -999 row are dropped.
  expect(out.every((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon))).toBe(true);
});

test("PM2.5 bands map to the EPA colour ramp", () => {
  expect(pm25Band(8)).toEqual({ label: "good", color: "#16a34a" });
  expect(pm25Band(25)).toEqual({ label: "moderate", color: "#eab308" });
  expect(pm25Band(45)).toEqual({ label: "unhealthy (sensitive)", color: "#f59e0b" });
  expect(pm25Band(100)).toEqual({ label: "unhealthy", color: "#dc2626" });
  expect(pm25Band(200)).toEqual({ label: "very unhealthy", color: "#7e22ce" });
  expect(pm25Band(400)).toEqual({ label: "hazardous", color: "#7f1d1d" });
});

test("worse air gives a bigger marker", () => {
  const out = normalizeAirStations(fixture as never);
  const sorted = [...out].sort(
    (a, b) => parseFloat(String(a.props?.pm25)) - parseFloat(String(b.props?.pm25)),
  );
  if (sorted.length >= 2) {
    const lo = Number(sorted[0].props?.magnitude);
    const hi = Number(sorted[sorted.length - 1].props?.magnitude);
    expect(hi).toBeGreaterThanOrEqual(lo);
  }
});
