import type { SignalFeature, SignalGeometry, SignalSource } from "@/lib/signals/types";

// TeleGeography Submarine Cable Map — open GeoJSON of the world's subsea
// telecom cables. Keyless FeatureCollection; each feature is a (Multi)LineString
// for one cable segment, with properties { id, name, color, feature_id,
// coordinates: [lon, lat] } — the `coordinates` prop is a precomputed
// representative point we reuse as the dossier anchor centroid. This is the
// framework's first LINE layer. Shape confirmed live 2026-06-27 (714 features).

const ENDPOINT = "https://www.submarinecablemap.com/api/v3/cable/cable-geo.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // cables change on the scale of months

export const CABLES_ATTRIBUTION = "Submarine cable data © TeleGeography (submarinecablemap.com)";

export const CABLES_COLOR = "#0d9488"; // one calm teal for all cables (LIGHT identity)

interface CableFeature {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: {
    id?: string;
    name?: string;
    feature_id?: string;
    coordinates?: [number, number]; // [lon, lat] representative point
  } | null;
}

/** Pure: cable-geo FeatureCollection → SignalFeature[] (LINE geometry). */
export function normalizeCables(geojson: { features?: CableFeature[] }): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const f of geojson.features ?? []) {
    const gType = f.geometry?.type;
    if (gType !== "LineString" && gType !== "MultiLineString") continue;
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) continue;
    const p = f.properties ?? {};
    // Anchor at the precomputed representative point; fall back to the first vertex.
    const rep = p.coordinates;
    let lon: number;
    let lat: number;
    if (Array.isArray(rep) && Number.isFinite(rep[0]) && Number.isFinite(rep[1])) {
      [lon, lat] = rep;
    } else {
      const first = gType === "MultiLineString" ? (coords as number[][][])[0]?.[0] : (coords as number[][])[0];
      if (!Array.isArray(first)) continue;
      [lon, lat] = first as [number, number];
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // feature_id is unique per segment; id is the cable id (shared across segments).
    const fid = (p.feature_id ?? p.id ?? "").toString().trim();
    if (!fid) continue;
    const geometry = { type: gType, coordinates: coords } as SignalGeometry;
    out.push({
      id: `cable:${fid}`,
      lat,
      lon,
      title: p.name?.trim() || "Submarine cable",
      signalId: "cables",
      color: CABLES_COLOR,
      geometry,
      link: "https://www.submarinecablemap.com/",
      props: {
        name: p.name?.trim() || "—",
        type: "Submarine telecom cable",
      },
    });
  }
  return out;
}

let cache: { features: SignalFeature[]; at: number } | null = null;

export const CABLES_SOURCE: SignalSource = {
  id: "cables",
  label: "Submarine cables",
  group: "Infrastructure",
  color: CABLES_COLOR,
  refreshMs: CACHE_TTL_MS,
  attribution: CABLES_ATTRIBUTION,
  async fetch() {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.features;
    try {
      const res = await fetch(ENDPOINT, {
        headers: { "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return cache?.features ?? [];
      const json = (await res.json()) as { features?: CableFeature[] };
      const features = normalizeCables(json);
      cache = { features, at: Date.now() };
      return features;
    } catch {
      return cache?.features ?? []; // dormant-safe
    }
  },
};
