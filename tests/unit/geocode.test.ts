import { expect, test } from "vitest";
import { normalizePhoton } from "@/lib/geo/geocode";

const fc = (features: unknown[]) => ({ type: "FeatureCollection", features });

test("flattens a Photon feature to { name, lat, lon, type, bbox }", () => {
  const out = normalizePhoton(
    fc([
      {
        type: "Feature",
        properties: {
          name: "Ben Nevis",
          osm_key: "natural",
          osm_value: "peak",
          type: "natural",
          state: "Scotland",
          country: "United Kingdom",
          countrycode: "GB",
          // Photon extent order: [west, north, east, south]
          extent: [-5.0752, 56.8355, -5.0711, 56.8344],
        },
        geometry: { type: "Point", coordinates: [-5.0035, 56.7969] },
      },
    ]),
  );
  expect(out).toHaveLength(1);
  expect(out[0].lat).toBeCloseTo(56.7969, 4); // coordinates are [lon, lat]
  expect(out[0].lon).toBeCloseTo(-5.0035, 4);
  expect(out[0].type).toBe("peak");
  expect(out[0].name).toContain("Ben Nevis");
  // bbox normalized to [west, south, east, north]
  expect(out[0].bbox).toEqual([-5.0752, 56.8344, -5.0711, 56.8355]);
});

test("builds a disambiguating label from name + city/state/country", () => {
  const out = normalizePhoton(
    fc([
      {
        properties: { name: "Westminster", city: "London", state: "England", country: "United Kingdom" },
        geometry: { type: "Point", coordinates: [-0.1357, 51.4995] },
      },
    ]),
  );
  expect(out[0].name).toBe("Westminster, London, England, United Kingdom");
});

test("does not repeat the primary name in the context (e.g. a city named only by city)", () => {
  const out = normalizePhoton(
    fc([
      {
        properties: { name: "Paris", city: "Paris", country: "France" },
        geometry: { type: "Point", coordinates: [2.3522, 48.8566] },
      },
    ]),
  );
  expect(out[0].name).toBe("Paris, France");
});

test("skips features with missing or out-of-range coordinates", () => {
  const out = normalizePhoton(
    fc([
      { properties: { name: "No geometry" } },
      { properties: { name: "Out of range" }, geometry: { type: "Point", coordinates: [200, 95] } },
      { properties: { name: "Non-numeric" }, geometry: { type: "Point", coordinates: ["x", "y"] } },
    ]),
  );
  expect(out).toEqual([]);
});

test("omits bbox when extent is absent or malformed", () => {
  const out = normalizePhoton(
    fc([
      {
        properties: { name: "Point Town", country: "France", extent: [1, 2, 3] },
        geometry: { type: "Point", coordinates: [2.3, 48.8] },
      },
    ]),
  );
  expect(out[0].bbox).toBeUndefined();
});

test("respects the limit and tolerates non-FeatureCollection input", () => {
  const many = fc(
    Array.from({ length: 10 }, (_, i) => ({
      properties: { name: `P${i}` },
      geometry: { type: "Point", coordinates: [i, i] },
    })),
  );
  expect(normalizePhoton(many, 3)).toHaveLength(3);
  expect(normalizePhoton(null)).toEqual([]);
  expect(normalizePhoton(undefined)).toEqual([]);
  expect(normalizePhoton({})).toEqual([]);
  expect(normalizePhoton({ features: "nope" })).toEqual([]);
});
