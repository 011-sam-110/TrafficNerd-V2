import type { SignalFeature, SignalSource } from "@/lib/signals/types";
import { centroidByIso2 } from "@/lib/signals/country-centroids.data";

// Internet outages — IODA (Internet Outage Detection & Analysis, Georgia Tech /
// CAIDA). Detects national-scale connectivity drops from three independent
// vantage points (active probing, BGP, telescope). Country-level internet
// shutdowns are a top-tier instability signal — governments cut connectivity
// during coups, contested elections and crackdowns. Keyless; country-aggregated:
// IODA already returns one score per affected country, so we anchor a marker at
// the country centroid sized by outage severity. Dormant-safe (→ [] on failure).

const SUMMARY_URL = "https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary";
const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";

export const IODA_ATTRIBUTION = "Internet-outage detection © IODA (CAIDA / Georgia Tech)";

interface IodaEntity {
  code?: string; // ISO-3166 alpha-2 for country entities
  name?: string;
  type?: string;
}
interface IodaRow {
  scores?: { overall?: number };
  event_cnt?: number;
  entity?: IodaEntity;
}

/** Severity → marker magnitude (log-scaled; IODA scores span ~1e3–1e6). */
function outageMagnitude(score: number): number {
  if (!(score > 0)) return 3;
  const m = Math.log10(score + 1) * 1.5; // ~4.7 at 1.5k, ~8.4 at 380k
  return Math.min(10, Math.max(3, Math.round(m * 10) / 10));
}

/** Pure: IODA country-summary payload → one SignalFeature per located country. */
export function normalizeOutages(json: { data?: IodaRow[] }): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const r of json.data ?? []) {
    const ent = r.entity;
    if (!ent || ent.type !== "country") continue;
    const code = (ent.code ?? "").trim().toUpperCase();
    if (!code) continue;
    const c = centroidByIso2(code);
    if (!c) continue; // unknown / non-country code (e.g. "ZZ") — skip
    const score = typeof r.scores?.overall === "number" ? r.scores.overall : 0;
    const events = typeof r.event_cnt === "number" ? r.event_cnt : 0;
    const name = ent.name?.trim() || c.name;
    out.push({
      id: `ioda:${code}`,
      lat: c.lat,
      lon: c.lon,
      title: `Internet outage — ${name}`,
      signalId: "internet-outages",
      color: "#b91c1c", // censorship/outage red
      props: {
        country: name,
        outageScore: Math.round(score),
        events,
        severity: score >= 100_000 ? "severe" : score >= 5_000 ? "elevated" : "localised",
        magnitude: outageMagnitude(score),
      },
    });
  }
  return out;
}

export const INTERNET_OUTAGES_SOURCE: SignalSource = {
  id: "internet-outages",
  label: "Internet outages (IODA)",
  group: "Infrastructure",
  color: "#b91c1c",
  refreshMs: 15 * 60 * 1000,
  attribution: IODA_ATTRIBUTION,
  async fetch() {
    // Look back 24h; IODA extends the window server-side to catch ongoing events.
    const until = Math.floor(Date.now() / 1000);
    const from = until - 24 * 3600;
    try {
      const res = await fetch(
        `${SUMMARY_URL}?from=${from}&until=${until}&entityType=country&limit=200`,
        { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(20_000) },
      );
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: IodaRow[] };
      return normalizeOutages(json);
    } catch {
      return [];
    }
  },
};
