import { expect, test } from "vitest";
// Live-captured NOAA SWPC Kp series + current storm-scale block.
import fixture from "@/tests/fixtures/space-weather.json";
import { normalizeSpaceWeather, gScaleColor, SPACE_WEATHER_SOURCE } from "@/lib/signals/space-weather";
import { rowMetric } from "@/lib/console/signals/signalCard";

test("emits a single status pin from the latest Kp + current scales", () => {
  const out = normalizeSpaceWeather(fixture as never);
  expect(out).toHaveLength(1);
  const f = out[0];
  expect(f.id).toBe("swpc:status");
  expect(f.signalId).toBe("space-weather");
  // Latest Kp in the fixture is 2.0 → quiet, geomagnetic storm "none".
  expect(f.props?.kp).toBe(2);
  expect(f.props?.condition).toBe("quiet");
  expect(f.props?.geomagneticStorm).toBe("none");
  expect(f.color).toBe(gScaleColor(0)); // G0 → green
  // Anchored near the north geomagnetic pole.
  expect(f.lat).toBeGreaterThan(75);
});

test("source metric resolves the real Kp index over the 0–9 domain", () => {
  const f = normalizeSpaceWeather(fixture as never)[0];
  // The declared metric must name the real Kp scalar, not the radius proxy.
  expect(SPACE_WEATHER_SOURCE.metric).toEqual({ field: "kp", domain: [0, 9] });
  expect(typeof f.props?.kp).toBe("number");
  const m = rowMetric(f, SPACE_WEATHER_SOURCE.metric);
  expect(m).toEqual({ value: 2, domain: [0, 9], label: "2" });
});

test("empty Kp series yields no feature; G-scale colours escalate", () => {
  expect(normalizeSpaceWeather({ kp: [], scales0: undefined })).toHaveLength(0);
  expect(gScaleColor(0)).toBe("#16a34a");
  expect(gScaleColor(3)).toBe("#ea580c");
  expect(gScaleColor(5)).toBe("#7f1d1d");
});

test("storm conditions raise the Kp label and marker magnitude", () => {
  const out = normalizeSpaceWeather({
    kp: [{ time_tag: "t", Kp: 7.33 }],
    scales0: { G: { Scale: "3" }, R: { Scale: "1" }, S: { Scale: "0" } },
  });
  const f = out[0];
  expect(f.props?.condition).toBe("severe storm");
  expect(f.props?.geomagneticStorm).toBe("G3");
  expect(f.props?.radioBlackout).toBe("R1");
  expect(f.color).toBe(gScaleColor(3));
  expect(Number(f.props?.magnitude)).toBeGreaterThan(7);
});
