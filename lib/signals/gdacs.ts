import type { SignalFeature, SignalSource } from "@/lib/signals/types";

// GDACS — the Global Disaster Alert & Coordination System (UN/EC). One keyless
// GeoJSON feed of the CURRENT global disaster picture: earthquakes, tropical
// cyclones, floods, volcanoes, droughts and wildfires, each with a Green/Orange/Red
// alert level. Complements the per-hazard feeds (USGS quakes, EONET fires/floods)
// with a single multi-hazard, severity-scored, alert-coloured overlay. The marker
// is GDACS's representative centroid. Confirmed live 2026-06-27.

const ENDPOINT = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP";
const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";

export const GDACS_ATTRIBUTION = "Disaster alerts © GDACS (UN OCHA / European Commission JRC)";

/** GDACS event-type code → human label. */
export function gdacsEventLabel(code: string): string {
  switch (code) {
    case "EQ": return "Earthquake";
    case "TC": return "Tropical cyclone";
    case "FL": return "Flood";
    case "VO": return "Volcano";
    case "DR": return "Drought";
    case "WF": return "Wildfire";
    case "TS": return "Tsunami";
    default: return "Disaster";
  }
}

/** GDACS alert level → colour (its own Green/Orange/Red triage). */
export function gdacsAlertColor(level: string): string {
  switch ((level || "").toLowerCase()) {
    case "red": return "#dc2626";
    case "orange": return "#f59e0b";
    case "green": return "#16a34a";
    default: return "#64748b";
  }
}

interface GdacsFeature {
  geometry?: { coordinates?: (number | null)[] } | null;
  properties?: {
    eventtype?: string;
    eventid?: number | string;
    episodeid?: number | string;
    name?: string;
    country?: string;
    alertlevel?: string;
    alertscore?: number;
    fromdate?: string;
    todate?: string;
    iscurrent?: string;
    url?: { report?: string; details?: string } | null;
    severitydata?: { severitytext?: string } | null;
  } | null;
}

/** Treat GDACS's naive UTC timestamps (no zone suffix) as UTC. */
function gdacsTimeToIso(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const norm = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  const t = Date.parse(norm);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

/** Maps GDACS alert level to a 0–10 normalized magnitude for the severity ramp. */
const GDACS_MAG: Record<string, number> = { Green: 3, Orange: 6, Red: 8 };

/** Pure: GDACS FeatureCollection → SignalFeature[]. Skips features without coords/id. */
export function normalizeGdacs(geojson: { features?: GdacsFeature[] }): SignalFeature[] {
  const out: SignalFeature[] = [];
  const seen = new Set<string>(); // GDACS repeats the same event+episode across entries — dedupe by id
  for (const f of geojson.features ?? []) {
    const p = f.properties ?? {};
    const c = f.geometry?.coordinates;
    if (!c) continue;
    const lon = c[0] == null ? Number.NaN : Number(c[0]);
    const lat = c[1] == null ? Number.NaN : Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const eventId = (p.eventid ?? "").toString().trim();
    if (!eventId) continue;
    const episodeId = (p.episodeid ?? "").toString().trim();
    const id = `gdacs:${eventId}:${episodeId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const typeLabel = gdacsEventLabel(p.eventtype ?? "");
    const level = p.alertlevel ?? "Unknown";
    out.push({
      id,
      lat,
      lon,
      title: p.name?.trim() || `${typeLabel}${p.country ? ` in ${p.country}` : ""}`,
      signalId: "gdacs",
      color: gdacsAlertColor(level),
      link: p.url?.report ?? undefined,
      ts: gdacsTimeToIso(p.fromdate),
      props: {
        hazard: typeLabel,
        alertLevel: level,
        magnitude: GDACS_MAG[level] ?? 5,
        // GDACS's own continuous alert score (0–3: green <1, orange 1–2, red 2–3).
        // The REAL per-event severity scalar (metric bar), distinct from the 0–10 ramp.
        alertScore: typeof p.alertscore === "number" && Number.isFinite(p.alertscore) ? p.alertscore : undefined,
        severity: p.severitydata?.severitytext?.trim() || "—",
        country: p.country?.trim() || "—",
        from: p.fromdate?.slice(0, 10) ?? "—",
        to: p.todate?.slice(0, 10) ?? "—",
        ongoing: (p.iscurrent ?? "").toLowerCase() === "true" ? "yes" : "no",
      },
    });
  }
  return out;
}

export const GDACS_SOURCE: SignalSource = {
  id: "gdacs",
  label: "Disaster alerts",
  group: "Natural hazards",
  color: "#e11d48",
  refreshMs: 600_000, // GDACS regenerates the map feed ~every few minutes
  attribution: GDACS_ATTRIBUTION,
  metric: { field: "alertScore", domain: [0, 3] },
  async fetch() {
    try {
      const res = await fetch(ENDPOINT, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { features?: GdacsFeature[] };
      return normalizeGdacs(json);
    } catch {
      return [];
    }
  },
};
