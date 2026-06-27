import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/open-meteo-air.json";
import { normalizeAirQuality, usAqiBand } from "@/lib/signals/airquality";
import type { City } from "@/lib/signals/cities.data";

const CITIES: City[] = [
  { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
];

test("normalizes Open-Meteo air quality, one feature per city with a US-AQI reading", () => {
  const out = normalizeAirQuality(fixture as never, CITIES);
  expect(out).toHaveLength(3);
  expect(out.map((f) => f.signalId)).toEqual(["airquality", "airquality", "airquality"]);
  expect(out[0].id).toBe("airquality:London");
  expect(out[0].lat).toBe(51.5074);

  const aqi = Math.round((fixture as never[])[0]["current"]["us_aqi"] as number);
  expect(out[0].props?.usAqi).toBe(aqi);
  expect(out[0].color).toBe(usAqiBand(aqi).color);
  expect(out[0].props?.category).toBe(usAqiBand(aqi).category);
});

test("skips a city with no AQI value", () => {
  const points = [...(fixture as never[]), { latitude: 0, longitude: 0, current: { us_aqi: null } }];
  const cities = [...CITIES, { name: "Nowhere", country: "—", lat: 0, lon: 0 }];
  expect(normalizeAirQuality(points as never, cities)).toHaveLength(3);
});

test("US AQI bands map to the EPA six-tier scale", () => {
  expect(usAqiBand(25).category).toBe("Good");
  expect(usAqiBand(75).category).toBe("Moderate");
  expect(usAqiBand(125).category).toBe("Unhealthy (sensitive)");
  expect(usAqiBand(180).category).toBe("Unhealthy");
  expect(usAqiBand(250).category).toBe("Very unhealthy");
  expect(usAqiBand(400).category).toBe("Hazardous");
});
