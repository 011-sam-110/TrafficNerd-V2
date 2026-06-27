import type { SignalFeature, SignalSource } from "@/lib/signals/types";
import { centroidByIso3 } from "@/lib/signals/country-centroids.data";
import { countMagnitude, toNum } from "@/lib/signals/aggregate";

// Forced displacement by country — keyless UNHCR population statistics API. One
// marker per country of asylum (ISO-3), summing the people it hosts or holds:
// refugees + asylum-seekers + internally-displaced. Country-level data (no precise
// location), so the marker sits at the country centroid, sized by total displaced,
// with crisis badges over 1M / 500K. Confirmed keyless 2026-06-27 (latest year 2024).

const ENDPOINT = "https://api.unhcr.org/population/v1/population/";
const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";

export const UNHCR_ATTRIBUTION = "Displacement data © UNHCR Refugee Data Finder";

interface UnRow {
  coa_iso?: string; // ISO-3 country of asylum
  coa_name?: string;
  refugees?: number | string;
  asylum_seekers?: number | string;
  idps?: number | string;
  stateless?: number | string;
  year?: number;
}

/** Amber→red ramp by total displaced. */
export function displacementColor(total: number): string {
  if (total >= 2_000_000) return "#7f1d1d";
  if (total >= 1_000_000) return "#b91c1c";
  if (total >= 250_000) return "#ea580c";
  if (total >= 50_000) return "#f59e0b";
  return "#fbbf24";
}

/** Pure: UNHCR rows → one SignalFeature per country of asylum (with a known centroid). */
export function normalizeDisplacement(rows: UnRow[]): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const r of rows) {
    const iso3 = (r.coa_iso ?? "").toUpperCase();
    const ctr = centroidByIso3(iso3);
    if (!ctr) continue; // skip aggregate/unknown rows ("-", "ZZZ", …)
    const refugees = toNum(r.refugees);
    const asylum = toNum(r.asylum_seekers);
    const idps = toNum(r.idps);
    const stateless = toNum(r.stateless);
    const total = refugees + asylum + idps;
    if (total <= 0) continue; // nothing to plot
    const crisis = total >= 1_000_000 ? "over 1M" : total >= 500_000 ? "over 500K" : undefined;
    out.push({
      id: `displacement:${iso3}`,
      lat: ctr.lat,
      lon: ctr.lon,
      title: `${ctr.name} — ${total.toLocaleString()} displaced`,
      signalId: "displacement",
      color: displacementColor(total),
      props: {
        country: ctr.name,
        totalDisplaced: total.toLocaleString(),
        refugees: refugees.toLocaleString(),
        asylumSeekers: asylum.toLocaleString(),
        idps: idps.toLocaleString(),
        stateless: stateless.toLocaleString(),
        ...(crisis ? { crisis } : {}),
        year: r.year ?? "—",
        magnitude: countMagnitude(total / 1000), // scale: thousands → ~0–10 radius
      },
    });
  }
  return out;
}

export const DISPLACEMENT_SOURCE: SignalSource = {
  id: "displacement",
  label: "Forced displacement",
  group: "Human cost",
  color: "#ea580c",
  refreshMs: 24 * 60 * 60 * 1000, // annual statistics; a daily cache is ample
  attribution: UNHCR_ATTRIBUTION,
  async fetch() {
    try {
      const year = new Date().getUTCFullYear() - 1; // latest fully-published year
      const url = `${ENDPOINT}?limit=1000&yearFrom=${year}&yearTo=${year}&coa_all=true`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { items?: UnRow[] };
      const rows = Array.isArray(json.items) ? json.items : [];
      const out = normalizeDisplacement(rows);
      // The most recent year may not be published yet → fall back one more year.
      if (out.length === 0) {
        const prev = year - 1;
        const res2 = await fetch(`${ENDPOINT}?limit=1000&yearFrom=${prev}&yearTo=${prev}&coa_all=true`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res2.ok) return [];
        const json2 = (await res2.json()) as { items?: UnRow[] };
        return normalizeDisplacement(Array.isArray(json2.items) ? json2.items : []);
      }
      return out;
    } catch {
      return [];
    }
  },
};
