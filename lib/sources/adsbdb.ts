// Flight enrichment from adsbdb.com — a free, keyless aircraft/route database.
//
// Two lookups, both called SERVER-side only (so the client never hits adsbdb and
// there's no CORS): callsign → origin/destination airports, hex → airframe
// (type/registration/owner). adsbdb answers an unknown id with HTTP 404 and a
// `{"response":"unknown callsign"|"unknown aircraft"}` string body, so the
// parsers below treat the string `response` as "no data" and return null. The
// dossier degrades gracefully on null — it never blocks on enrichment.
//
// Contract confirmed live 2026-06-27 against:
//   GET https://api.adsbdb.com/v0/callsign/{callsign}
//   GET https://api.adsbdb.com/v0/aircraft/{hex}

const BASE = "https://api.adsbdb.com/v0";
const TIMEOUT_MS = 7_000;
const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";

// --- Normalized shapes the dossier consumes --------------------------------

export interface FlightAirport {
  iata: string;
  icao: string;
  name: string;
  municipality: string;
  countryIso: string;
  lat: number;
  lon: number;
}

export interface FlightRoute {
  callsign: string;
  airline: string | null;
  origin: FlightAirport | null;
  destination: FlightAirport | null;
}

export interface AircraftInfo {
  type: string | null;
  icaoType: string | null;
  manufacturer: string | null;
  registration: string | null;
  owner: string | null;
  ownerCountry: string | null;
}

export interface FlightEnrichment {
  route: FlightRoute | null;
  aircraft: AircraftInfo | null;
}

// --- Raw adsbdb response shapes (only the fields we read) -------------------

interface RawAirport {
  iata_code?: string;
  icao_code?: string;
  name?: string;
  municipality?: string;
  country_iso_name?: string;
  latitude?: number;
  longitude?: number;
}

interface RawFlightroute {
  callsign?: string;
  airline?: { name?: string } | null;
  origin?: RawAirport | null;
  destination?: RawAirport | null;
}

interface RawAircraft {
  type?: string;
  icao_type?: string;
  manufacturer?: string;
  registration?: string;
  registered_owner?: string;
  registered_owner_country_name?: string;
  mode_s?: string;
}

// `response` is the data object on success, or a plain string on a miss.
type RawResponse<K extends string, V> = { response?: (Record<K, V> & object) | string };

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function airport(a: RawAirport | null | undefined): FlightAirport | null {
  if (!a) return null;
  const lat = typeof a.latitude === "number" ? a.latitude : null;
  const lon = typeof a.longitude === "number" ? a.longitude : null;
  const icao = str(a.icao_code);
  const iata = str(a.iata_code);
  if (lat === null || lon === null || (!icao && !iata)) return null;
  return {
    iata: iata ?? "",
    icao: icao ?? "",
    name: str(a.name) ?? "",
    municipality: str(a.municipality) ?? "",
    countryIso: str(a.country_iso_name) ?? "",
    lat,
    lon,
  };
}

/** Parse an adsbdb callsign response into a {@link FlightRoute}, or null on a miss. */
export function parseFlightRoute(json: RawResponse<"flightroute", RawFlightroute>): FlightRoute | null {
  const r = json?.response;
  if (!r || typeof r === "string") return null; // "unknown callsign"
  const fr = r.flightroute;
  if (!fr) return null;
  const origin = airport(fr.origin);
  const destination = airport(fr.destination);
  if (!origin && !destination) return null; // nothing useful to show
  return {
    callsign: str(fr.callsign) ?? "",
    airline: str(fr.airline?.name),
    origin,
    destination,
  };
}

/** Parse an adsbdb aircraft response into {@link AircraftInfo}, or null on a miss. */
export function parseAircraft(json: RawResponse<"aircraft", RawAircraft>): AircraftInfo | null {
  const r = json?.response;
  if (!r || typeof r === "string") return null; // "unknown aircraft"
  const a = r.aircraft;
  if (!a) return null;
  const info: AircraftInfo = {
    type: str(a.type),
    icaoType: str(a.icao_type),
    manufacturer: str(a.manufacturer),
    registration: str(a.registration),
    owner: str(a.registered_owner),
    ownerCountry: str(a.registered_owner_country_name),
  };
  // If every field is empty there's nothing to enrich with.
  return Object.values(info).some((v) => v !== null) ? info : null;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 404 = unknown id; adsbdb still returns JSON, so parse and let the parser
    // return null. Any other non-OK (5xx/429) → treat as "no data".
    if (!res.ok && res.status !== 404) return null;
    return (await res.json()) as unknown;
  } catch {
    return null; // network/timeout/redirect → dormant-safe
  }
}

// Short server-side caches so rapid dossier opens don't hammer adsbdb. Routes
// change rarely; airframes effectively never. null results are cached too (so a
// genuine miss isn't re-fetched every click).
const ROUTE_TTL_MS = 5 * 60_000;
const AIRFRAME_TTL_MS = 60 * 60_000;
const routeCache = new Map<string, { at: number; value: FlightRoute | null }>();
const aircraftCache = new Map<string, { at: number; value: AircraftInfo | null }>();

/** callsign → route (origin/destination), server-cached ~5 min. null on miss. */
export async function fetchFlightRoute(callsign: string, now = Date.now()): Promise<FlightRoute | null> {
  const key = callsign.trim().toUpperCase();
  if (!key) return null;
  const hit = routeCache.get(key);
  if (hit && now - hit.at < ROUTE_TTL_MS) return hit.value;
  const json = await getJson(`${BASE}/callsign/${encodeURIComponent(key)}`);
  const value = json ? parseFlightRoute(json as RawResponse<"flightroute", RawFlightroute>) : null;
  routeCache.set(key, { at: now, value });
  return value;
}

/** hex (mode-S) → airframe, server-cached ~60 min. null on miss. */
export async function fetchAircraftInfo(hex: string, now = Date.now()): Promise<AircraftInfo | null> {
  const key = hex.trim().toUpperCase();
  if (!key || key === "UNKNOWN") return null;
  const hit = aircraftCache.get(key);
  if (hit && now - hit.at < AIRFRAME_TTL_MS) return hit.value;
  const json = await getJson(`${BASE}/aircraft/${encodeURIComponent(key)}`);
  const value = json ? parseAircraft(json as RawResponse<"aircraft", RawAircraft>) : null;
  aircraftCache.set(key, { at: now, value });
  return value;
}
