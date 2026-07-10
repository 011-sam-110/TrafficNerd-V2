import type { SignalFeature, SignalSource } from "@/lib/signals/types";

// GDELT GEO 2.0 API — geolocated clusters of recent global news coverage. ONE
// keyword query per layer; the API returns a GeoJSON FeatureCollection of places
// (PointData mode), each carrying how many matching articles mention it (`count`),
// a representative `shareimage`, and an `html` popup whose first <a href> is the
// canonical source article. Keyless.
//
// Endpoint + params confirmed against the official GDELT GEO 2.0 docs
// (blog.gdeltproject.org/gdelt-geo-2-0-api-debuts):
//   https://api.gdeltproject.org/api/v2/geo/geo
//     ?query=<keyword OR-group>     URL-encoded
//     &mode=PointData               (default; one point per geolocated place)
//     &format=GeoJSON               compliant FeatureCollection
//     &timespan=24h                 trailing window of coverage
//     &maxpoints=250                upstream cap (we ALSO hard-cap below)
//
// GDELT can return a LOT of points for a busy query, so we sort by article count
// and HARD-CAP at MAX_POINTS regardless of upstream. Cache ≥15 min per query
// (GDELT is slow + rate-limits aggressively). Dormant-safe: any failure → [].

const ENDPOINT = "https://api.gdeltproject.org/api/v2/geo/geo";
const TIMESPAN = "24h";
const UPSTREAM_MAXPOINTS = 250;
const MAX_POINTS = 300; // belt-and-braces local hard cap
const CACHE_TTL_MS = 15 * 60 * 1000;

export const GDELT_ATTRIBUTION = "News-event geocoding © The GDELT Project";

export interface GdeltFeature {
  type?: string;
  geometry?: { type?: string; coordinates?: (number | null)[] } | null;
  properties?: {
    name?: string | null;
    count?: number | null;
    shareimage?: string | null;
    html?: string | null;
  } | null;
}

export interface GdeltGeoJson {
  type?: string;
  features?: GdeltFeature[];
}

/** Per-layer config: the registry id, the rail colour, and the GDELT query. */
export interface GdeltLayerMeta {
  signalId: string;
  label: string;
  color: string;
  query: string;
}

// Keyword OR-groups (GDELT boolean syntax). Kept to unambiguous conflict /
// protest vocabulary so the geocoded coverage stays on-theme.
export const GDELT_LAYERS: Record<string, GdeltLayerMeta> = {
  conflict: {
    signalId: "conflict",
    label: "Conflict",
    color: "#b91c1c",
    query: "(conflict OR airstrike OR clashes OR shelling OR militants OR offensive OR insurgents)",
  },
  protests: {
    signalId: "protests",
    label: "Protests",
    color: "#7c3aed",
    query: "(protest OR protesters OR demonstration OR rally OR uprising OR marched)",
  },
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

/** Pull the first article URL out of GDELT's popup `html` blob, if any. */
export function firstHref(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const m = html.match(/href=["']([^"']+)["']/i);
  if (!m) return undefined;
  const url = decodeEntities(m[1].trim());
  return /^https?:\/\//i.test(url) ? url : undefined;
}

/**
 * Pure: GDELT GeoJSON → SignalFeature[] for one layer. Skips features with no
 * usable point, sorts by article count descending and hard-caps at `cap`.
 */
export function normalizeGdelt(
  geojson: GdeltGeoJson,
  meta: GdeltLayerMeta,
  cap = MAX_POINTS,
): SignalFeature[] {
  const rows = (geojson.features ?? [])
    .map((f) => {
      const c = f.geometry?.coordinates;
      if (!Array.isArray(c)) return null;
      const lon = c[0] == null ? Number.NaN : Number(c[0]);
      const lat = c[1] == null ? Number.NaN : Number(c[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
      const p = f.properties ?? {};
      const name = p.name?.toString().trim();
      if (!name) return null;
      const count = Number.isFinite(Number(p.count)) ? Math.max(0, Math.round(Number(p.count))) : 0;
      return { lat, lon, name, count, html: p.html ?? null };
    })
    .filter((r): r is { lat: number; lon: number; name: string; count: number; html: string | null } => r != null)
    .sort((a, b) => b.count - a.count)
    .slice(0, cap);

  const out: SignalFeature[] = [];
  for (const r of rows) {
    out.push({
      id: `gdelt:${meta.signalId}:${r.lat.toFixed(3)}:${r.lon.toFixed(3)}`,
      lat: r.lat,
      lon: r.lon,
      title: decodeEntities(r.name),
      signalId: meta.signalId,
      color: meta.color,
      link: firstHref(r.html),
      props: {
        // `count` is article volume, NOT a 0–10 magnitude — keep it off `magnitude`
        // so it never distorts the marker radius (see types.ts convention).
        articles: r.count,
        place: decodeEntities(r.name),
        window: `last ${TIMESPAN}`,
      },
    });
  }
  return out;
}

// --- Per-query cached upstream fetch ---------------------------------------
// Two layers ⇒ two distinct queries ⇒ two cache slots. SWR-ish: serve cached
// until TTL, then refresh once (concurrent toggles share the inflight promise).
interface QueryCache {
  features: GdeltFeature[];
  at: number;
}
const cache = new Map<string, QueryCache>();
const inflight = new Map<string, Promise<GdeltFeature[]>>();

function buildUrl(query: string): string {
  const u = new URL(ENDPOINT);
  u.searchParams.set("query", query);
  u.searchParams.set("mode", "PointData");
  u.searchParams.set("format", "GeoJSON");
  u.searchParams.set("timespan", TIMESPAN);
  u.searchParams.set("maxpoints", String(UPSTREAM_MAXPOINTS));
  return u.toString();
}

async function refresh(query: string): Promise<GdeltFeature[]> {
  const res = await fetch(buildUrl(query), {
    headers: { "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
    signal: AbortSignal.timeout(20_000), // GDELT is slow
  });
  if (!res.ok) throw new Error(`GDELT: ${res.status}`);
  const json = (await res.json()) as GdeltGeoJson;
  cache.set(query, { features: json.features ?? [], at: Date.now() });
  return json.features ?? [];
}

/** Fresh-or-stale-while-revalidate per query. Never throws. */
export async function fetchGdelt(query: string): Promise<GdeltFeature[]> {
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.features;
  let pending = inflight.get(query);
  if (!pending) {
    pending = refresh(query)
      .catch(() => cache.get(query)?.features ?? [])
      .finally(() => inflight.delete(query));
    inflight.set(query, pending);
  }
  return hit ? hit.features : pending;
}

function makeSource(meta: GdeltLayerMeta): SignalSource {
  return {
    id: meta.signalId,
    label: meta.label,
    group: "Intel",
    color: meta.color,
    refreshMs: 20 * 60 * 1000, // GDELT updates every ~15 min; cache matches
    attribution: GDELT_ATTRIBUTION,
    // Real scalar: `count` = number of matching articles geolocated to this place
    // in the trailing 24h (stored as the finite `articles` prop). A quiet place is
    // a handful of mentions; a heavily-covered flashpoint runs to ~100+.
    metric: { field: "articles", domain: [1, 100], unit: " articles" },
    async fetch() {
      try {
        const features = await fetchGdelt(meta.query);
        return normalizeGdelt({ features }, meta);
      } catch {
        return []; // dormant-safe
      }
    },
  };
}

export const CONFLICT_SOURCE = makeSource(GDELT_LAYERS.conflict);
export const PROTESTS_SOURCE = makeSource(GDELT_LAYERS.protests);
