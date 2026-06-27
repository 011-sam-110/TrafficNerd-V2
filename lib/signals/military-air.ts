import type { SignalFeature, SignalSource } from "@/lib/signals/types";

// Military aircraft worldwide — keyless adsb.lol / adsb.fi `/mil` feed. Most ADS-B
// aggregators (and OpenSky's anonymous tier) FILTER OUT military traffic, which is
// exactly the traffic that matters for posture/movement. These two community feeds
// expose the unfiltered military set globally. One point per live aircraft, with
// type, callsign, registration, altitude and speed. Confirmed keyless 2026-06-27.

const ENDPOINTS = [
  "https://api.adsb.lol/v2/mil",
  "https://opendata.adsb.fi/api/v2/mil", // fallback (also carries a `desc` field)
];
const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";

export const ADSB_MIL_ATTRIBUTION = "Military ADS-B © adsb.lol / adsb.fi (community feeds)";

interface AcRow {
  hex?: string;
  flight?: string; // callsign
  r?: string; // registration / tail
  t?: string; // ICAO type code, e.g. "C17"
  desc?: string; // full type description (adsb.fi only)
  alt_baro?: number | string; // feet, or "ground"
  gs?: number; // ground speed (kt)
  track?: number; // heading
  squawk?: string;
  lat?: number;
  lon?: number;
}

function altitude(a: AcRow["alt_baro"]): string {
  if (typeof a === "number" && Number.isFinite(a)) return `${a.toLocaleString()} ft`;
  if (typeof a === "string" && a.toLowerCase() === "ground") return "on ground";
  return "—";
}

/** Pure: adsb `/mil` payload → one SignalFeature per aircraft with a position. */
export function normalizeMilitaryAir(json: { ac?: AcRow[] }): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const a of json.ac ?? []) {
    const lat = typeof a.lat === "number" ? a.lat : Number.NaN;
    const lon = typeof a.lon === "number" ? a.lon : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const hex = (a.hex ?? "").trim();
    if (!hex) continue;
    const callsign = (a.flight ?? "").trim();
    const typeName = a.desc?.trim() || a.t?.trim() || "Military aircraft";
    out.push({
      id: `mil:${hex}`,
      lat,
      lon,
      title: `${callsign || hex} — ${typeName}`,
      signalId: "military-air",
      color: "#3f6212", // military olive — distinct from civil plane amber
      props: {
        callsign: callsign || "—",
        type: typeName,
        typeCode: a.t ?? "—",
        registration: a.r?.trim() || "—",
        altitude: altitude(a.alt_baro),
        speed: typeof a.gs === "number" ? `${Math.round(a.gs)} kt` : "—",
        heading: typeof a.track === "number" ? `${Math.round(a.track)}°` : "—",
        squawk: a.squawk ?? "—",
        hex,
      },
    });
  }
  return out;
}

export const MILITARY_AIR_SOURCE: SignalSource = {
  id: "military-air",
  label: "Military flights",
  group: "Military",
  color: "#3f6212",
  refreshMs: 20_000, // live aircraft — a short cache keeps positions current
  attribution: ADSB_MIL_ATTRIBUTION,
  async fetch() {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { ac?: AcRow[] };
        const out = normalizeMilitaryAir(json);
        if (out.length) return out;
      } catch {
        // try the next endpoint
      }
    }
    return []; // dormant-safe: both feeds unreachable → nothing
  },
};
