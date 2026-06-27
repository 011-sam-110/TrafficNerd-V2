import { expect, test } from "vitest";
import { parseFlightRoute, parseAircraft } from "@/lib/sources/adsbdb";

// Fixtures captured verbatim from the live adsbdb API on 2026-06-27.

const ROUTE_OK = {
  response: {
    flightroute: {
      callsign: "BAW117",
      callsign_icao: "BAW117",
      callsign_iata: "BA117",
      airline: { name: "British Airways", icao: "BAW", iata: "BA", country: "United Kingdom" },
      origin: {
        country_iso_name: "GB",
        country_name: "United Kingdom",
        elevation: 83,
        iata_code: "LHR",
        icao_code: "EGLL",
        latitude: 51.4706,
        longitude: -0.461941,
        municipality: "London",
        name: "London Heathrow Airport",
      },
      destination: {
        country_iso_name: "US",
        country_name: "United States",
        elevation: 13,
        iata_code: "JFK",
        icao_code: "KJFK",
        latitude: 40.639801,
        longitude: -73.7789,
        municipality: "New York",
        name: "John F Kennedy International Airport",
      },
    },
  },
};

const AIRCRAFT_OK = {
  response: {
    aircraft: {
      type: "G650 ER",
      icao_type: "G650",
      manufacturer: "Gulfstream Aerospace",
      mode_s: "A835AF",
      registration: "N628TS",
      registered_owner_country_iso_name: "US",
      registered_owner_country_name: "United States",
      registered_owner: "Falcon Landing LLC",
      url_photo: "https://airport-data.com/images/aircraft/001/598/001598299.jpg",
    },
  },
};

test("parseFlightRoute normalizes origin → destination airports", () => {
  const r = parseFlightRoute(ROUTE_OK);
  expect(r).not.toBeNull();
  expect(r?.callsign).toBe("BAW117");
  expect(r?.airline).toBe("British Airways");
  expect(r?.origin).toMatchObject({ icao: "EGLL", iata: "LHR", municipality: "London", lat: 51.4706 });
  expect(r?.destination).toMatchObject({ icao: "KJFK", iata: "JFK", municipality: "New York" });
  expect(r?.destination?.lon).toBeCloseTo(-73.7789, 4);
});

test("parseFlightRoute returns null for an unknown callsign (string response)", () => {
  expect(parseFlightRoute({ response: "unknown callsign" })).toBeNull();
  expect(parseFlightRoute({})).toBeNull();
});

test("parseFlightRoute returns null when no usable airport is present", () => {
  expect(parseFlightRoute({ response: { flightroute: { callsign: "X", origin: null, destination: null } } })).toBeNull();
});

test("parseAircraft normalizes the airframe fields", () => {
  const a = parseAircraft(AIRCRAFT_OK);
  expect(a).not.toBeNull();
  expect(a?.type).toBe("G650 ER");
  expect(a?.manufacturer).toBe("Gulfstream Aerospace");
  expect(a?.registration).toBe("N628TS");
  expect(a?.owner).toBe("Falcon Landing LLC");
  expect(a?.ownerCountry).toBe("United States");
});

test("parseAircraft returns null for an unknown hex (string response)", () => {
  expect(parseAircraft({ response: "unknown aircraft" })).toBeNull();
  expect(parseAircraft({})).toBeNull();
});
