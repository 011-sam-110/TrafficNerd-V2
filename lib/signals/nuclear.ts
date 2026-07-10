import type { SignalFeature, SignalSource } from "@/lib/signals/types";

// Nuclear power plants — live from OpenStreetMap via the Overpass API. Keyless.
// Query: every `power=plant` tagged `plant:source=nuclear`, returned with a
// `center` for ways/relations. ~219 plants worldwide (confirmed live 2026-06-27),
// so the payload is light. We surface name, electrical output and operator where
// OSM has them. Overpass can be slow/under load, so we cache HARD (12h) + keep a
// stale-on-error copy; a failure just yields nothing (dormant-safe).

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const QUERY =
  '[out:json][timeout:60];nwr["plant:source"="nuclear"]["power"="plant"];out center tags;';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export const NUCLEAR_ATTRIBUTION = "Nuclear plant data © OpenStreetMap contributors (via Overpass API)";

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/**
 * Parse an OSM `plant:output:electricity` string (e.g. "1180 MW", "57 MW",
 * "1.18 GW") into net electrical capacity in MW. Returns undefined when the tag
 * is missing or unparseable — so we never fabricate a scalar.
 */
export function parseOutputMw(output: string | undefined): number | undefined {
  if (!output) return undefined;
  const m = output.match(/([\d.]+)\s*(GW|MW|kW|W)?/i);
  if (!m) return undefined;
  const val = parseFloat(m[1]);
  if (!Number.isFinite(val)) return undefined;
  const unit = (m[2] ?? "MW").toUpperCase();
  const factor = unit === "GW" ? 1000 : unit === "KW" ? 0.001 : unit === "W" ? 1e-6 : 1;
  return Math.round(val * factor);
}

/** Pure: Overpass elements → SignalFeature[] (one point per named plant). */
export function normalizeOverpassNuclear(json: { elements?: OverpassElement[] }): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const e of json.elements ?? []) {
    const t = e.tags ?? {};
    const name = t.name?.trim();
    if (!name) continue; // skip unnamed fragments
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = `${e.type ?? "n"}/${e.id ?? ""}`.trim();
    if (id === "n/") continue;
    const output = t["plant:output:electricity"];
    const outputMw = parseOutputMw(output);
    const operator = t.operator || t["operator:wikidata"];
    out.push({
      id: `nuclear:${id}`,
      lat: lat as number,
      lon: lon as number,
      title: name,
      signalId: "nuclear",
      color: "#16a34a",
      link: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      props: {
        type: "Nuclear power plant",
        ...(output ? { output } : {}),
        ...(outputMw != null ? { outputMw } : {}),
        ...(operator ? { operator } : {}),
        ...(t["start_date"] ? { commissioned: t["start_date"] } : {}),
      },
    });
  }
  return out;
}

let cache: { features: SignalFeature[]; at: number } | null = null;

export const NUCLEAR_SOURCE: SignalSource = {
  id: "nuclear",
  label: "Nuclear plants",
  group: "Infrastructure",
  color: "#16a34a",
  refreshMs: CACHE_TTL_MS,
  attribution: NUCLEAR_ATTRIBUTION,
  // Real per-plant scalar: net electrical capacity in MW (OSM plant:output:electricity).
  // Calm ≈ 0; extreme ≈ 8000 MW (world's largest stations, e.g. Kashiwazaki-Kariwa).
  metric: { field: "outputMw", domain: [0, 8000], unit: " MW" },
  async fetch() {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.features;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) return cache?.features ?? [];
      const json = (await res.json()) as { elements?: OverpassElement[] };
      const features = normalizeOverpassNuclear(json);
      cache = { features, at: Date.now() };
      return features;
    } catch {
      return cache?.features ?? []; // dormant-safe
    }
  },
};
