import type { SignalFeature, SignalSource } from "@/lib/signals/types";
import { centroidByIso3 } from "@/lib/signals/country-centroids.data";
import { countMagnitude } from "@/lib/signals/aggregate";

// Food insecurity by country — keyless WFP HungerMap. Acute hunger is a recognised
// instability accelerant (it would feed the Country Instability Index the way the
// climate-anomaly signal does). HungerMap publishes, per country, the number and
// share of people with insufficient food consumption (FCS), a near-real-time
// nowcast. Country-level → one marker at the centroid, sized by people affected and
// coloured by prevalence. Confirmed keyless 2026-06-27.

const ENDPOINT = "https://api.hungermapdata.org/v1/foodsecurity/country";
const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";

export const HUNGERMAP_ATTRIBUTION = "Food-security data © WFP HungerMap LIVE";

interface HmMetric {
  people?: number;
  prevalence?: number; // 0–1 share of population
}
interface HmCountry {
  country?: { iso3?: string; name?: string };
  date?: string;
  dataType?: string; // "PREDICTION" | "FORECAST" | "ACTUAL DATA" …
  metrics?: { fcs?: HmMetric; rcsi?: HmMetric };
}

/** Yellow→deep-red ramp by the share of the population with insufficient food. */
export function foodInsecurityColor(prevalence: number): string {
  if (prevalence >= 0.4) return "#7f1d1d";
  if (prevalence >= 0.25) return "#dc2626";
  if (prevalence >= 0.15) return "#ea580c";
  if (prevalence >= 0.05) return "#f59e0b";
  return "#fbbf24";
}

/** Pure: HungerMap payload → one SignalFeature per country with a real FCS reading. */
export function normalizeFoodSecurity(json: { body?: { countries?: HmCountry[] } }): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const c of json.body?.countries ?? []) {
    const iso3 = (c.country?.iso3 ?? "").toUpperCase();
    const ctr = centroidByIso3(iso3);
    if (!ctr) continue;
    const fcs = c.metrics?.fcs;
    const people = typeof fcs?.people === "number" ? fcs.people : 0;
    if (people <= 0) continue;
    const prevalence = typeof fcs?.prevalence === "number" ? fcs.prevalence : 0;
    const pct = Math.round(prevalence * 100);
    out.push({
      id: `food:${iso3}`,
      lat: ctr.lat,
      lon: ctr.lon,
      title: `${ctr.name} — ${people.toLocaleString()} food-insecure (${pct}%)`,
      signalId: "food-security",
      color: foodInsecurityColor(prevalence),
      props: {
        country: ctr.name,
        insufficientFood: people.toLocaleString(),
        prevalence: `${pct}%`,
        prevalencePct: pct, // real FCS prevalence as a finite number (drives the metric bar)
        ...(typeof c.metrics?.rcsi?.prevalence === "number"
          ? { crisisCoping: `${Math.round(c.metrics.rcsi.prevalence * 100)}%` }
          : {}),
        basis: c.dataType ?? "—",
        asOf: c.date ?? "—",
        magnitude: countMagnitude(people / 100_000),
      },
    });
  }
  return out;
}

export const FOOD_SECURITY_SOURCE: SignalSource = {
  id: "food-security",
  label: "Food insecurity",
  group: "Human cost",
  color: "#ea580c",
  refreshMs: 6 * 60 * 60 * 1000, // a daily-ish nowcast; 6-hour cache is ample
  attribution: HUNGERMAP_ATTRIBUTION,
  // Share of the population with insufficient food consumption (FCS). ~5% is an
  // unremarkable baseline; ≥50% (e.g. Afghanistan) is a full-blown food emergency.
  metric: { field: "prevalencePct", domain: [5, 50], unit: " %" },
  async fetch() {
    try {
      const res = await fetch(ENDPOINT, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { body?: { countries?: HmCountry[] } };
      return normalizeFoodSecurity(json);
    } catch {
      return [];
    }
  },
};
