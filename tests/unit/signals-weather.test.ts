import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/open-meteo-weather.json";
import { normalizeWeather, weatherCodeLabel, temperatureColor, WEATHER_SOURCE } from "@/lib/signals/weather";
import { rowMetric } from "@/lib/console/signals/signalCard";
import type { City } from "@/lib/signals/cities.data";

// The fixture was captured for these three cities, in this order.
const CITIES: City[] = [
  { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
];

test("normalizes Open-Meteo current weather, one feature per city at the city's own coords", () => {
  const out = normalizeWeather(fixture as never, CITIES);
  expect(out).toHaveLength(3);
  expect(out.map((f) => f.signalId)).toEqual(["weather", "weather", "weather"]);
  expect(out[0].id).toBe("weather:London");
  // Marker sits at the curated city coordinate, not Open-Meteo's snapped grid point.
  expect(out[0].lat).toBe(51.5074);
  expect(out[0].lon).toBe(-0.1278);
  // Colour + temperature prop are derived from the fixture's own reading.
  const temp = (fixture as never[])[0]["current"]["temperature_2m"] as number;
  expect(out[0].color).toBe(temperatureColor(temp));
  expect(out[0].props?.temperature).toBe(`${temp.toFixed(1)} °C`);
  expect(typeof out[0].ts).toBe("string");
});

test("exposes a finite numeric tempC that the source metric resolves for the monitor bar", () => {
  const out = normalizeWeather(fixture as never, CITIES);
  const temp = (fixture as never[])[0]["current"]["temperature_2m"] as number;
  // A real numeric scalar sits alongside the formatted display string.
  expect(out[0].props?.tempC).toBe(temp);
  expect(typeof out[0].props?.tempC).toBe("number");
  expect(Number.isFinite(out[0].props?.tempC as number)).toBe(true);
  // The source declares that scalar as its metric with a habitable-range domain.
  expect(WEATHER_SOURCE.metric).toEqual({ field: "tempC", domain: [-10, 40], unit: " °C" });
  const resolved = rowMetric(out[0], WEATHER_SOURCE.metric);
  expect(resolved).toEqual({ value: temp, domain: [-10, 40], label: `${temp.toFixed(1)} °C` });
});

test("skips a city with no usable current reading", () => {
  const points = [...(fixture as never[]), { latitude: 0, longitude: 0, current: null }];
  const cities = [...CITIES, { name: "Nowhere", country: "—", lat: 0, lon: 0 }];
  expect(normalizeWeather(points as never, cities)).toHaveLength(3);
});

test("WMO code → condition and the temperature ramp", () => {
  expect(weatherCodeLabel(0).label).toBe("Clear");
  expect(weatherCodeLabel(95).label).toBe("Thunderstorm");
  expect(weatherCodeLabel(61).label).toBe("Rain");
  expect(temperatureColor(-5)).toBe("#3b82f6");
  expect(temperatureColor(40)).toBe("#dc2626");
  expect(temperatureColor(20)).toBe("#eab308");
});
