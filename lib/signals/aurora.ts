import type { SignalFeature, SignalSource } from "@/lib/signals/types";

// NOAA SWPC OVATION aurora forecast — the modelled probability (%) of visible
// aurora on a 1°×1° global grid for the next ~30 min. Keyless JSON:
//   { "Observation Time", "Forecast Time", "coordinates": [[lon, lat, aurora%], …] }
// Longitude is 0–359 (wrapped to −180..180 here). The raw grid is ~65k cells —
// almost all 0% — so we keep only HIGH-probability cells and HARD-CAP the count
// (top-N by probability) so this can never become a 100k-point dump on the globe.
// Shape confirmed live 2026-06-27.

const ENDPOINT = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
const MIN_PROBABILITY = 50; // only render cells where aurora is genuinely likely
const MAX_POINTS = 300; // hard cap — keep the layer light on the globe

export const AURORA_ATTRIBUTION = "Aurora forecast © NOAA Space Weather Prediction Center";

export interface OvationGrid {
  "Observation Time"?: string;
  "Forecast Time"?: string;
  coordinates?: [number, number, number][];
}

/** Green → white ramp by probability (brighter = more likely). */
export function auroraColor(pct: number): string {
  if (pct >= 90) return "#ecfdf5";
  if (pct >= 75) return "#6ee7b7";
  if (pct >= 60) return "#34d399";
  return "#22c55e";
}

/**
 * Pure: OVATION grid → SignalFeature[]. Keeps cells at/above `minProbability`,
 * sorts by probability descending and caps at `cap` so the result is bounded
 * regardless of how active the aurora is.
 */
export function normalizeAurora(
  json: OvationGrid,
  minProbability = MIN_PROBABILITY,
  cap = MAX_POINTS,
): SignalFeature[] {
  const forecast = json["Forecast Time"];
  const rows = (json.coordinates ?? [])
    .filter((c) => Array.isArray(c) && Number(c[2]) >= minProbability)
    .sort((a, b) => Number(b[2]) - Number(a[2]))
    .slice(0, cap);
  const out: SignalFeature[] = [];
  for (const [rawLon, lat, pct] of rows) {
    const lon = rawLon > 180 ? rawLon - 360 : rawLon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: `aurora:${rawLon}:${lat}`,
      lat,
      lon,
      title: `Aurora ${pct}% likely`,
      signalId: "aurora",
      color: auroraColor(pct),
      ts: forecast,
      props: {
        probability: `${pct}%`,
        // Sibling numeric scalar (the display string above is "NN%"): the real
        // OVATION aurora-visibility probability, so the generic monitor can rank
        // + bar it instead of the log-radius proxy.
        probabilityPct: pct,
        forecastFor: forecast ?? "—",
      },
    });
  }
  return out;
}

export const AURORA_SOURCE: SignalSource = {
  id: "aurora",
  label: "Aurora",
  group: "Space weather",
  color: "#22c55e",
  refreshMs: 5 * 60 * 1000, // SWPC publishes a new grid every few minutes
  attribution: AURORA_ATTRIBUTION,
  kind: "forecast", // a spatial visibility FIELD → the forecast focus view (peak + where)
  // Real OVATION visibility probability (0–100%); rendered cells are ≥50%, so the
  // bar fills across the meaningful half — 100% is a near-certain-aurora extreme.
  metric: { field: "probabilityPct", domain: [0, 100], unit: "%" },
  forecast: {
    spatial: true,
    activeNoun: "cells ≥50% likely",
    quietNote: "No visible aurora forecast right now — the OVATION grid has no high-probability cells.",
    bands: [
      { min: 50, label: "Visible", color: "#22c55e" },
      { min: 75, label: "Strong", color: "#34d399" },
      { min: 90, label: "Brilliant", color: "#10b981" },
    ],
  },
  async fetch() {
    try {
      const res = await fetch(ENDPOINT, {
        headers: { "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as OvationGrid;
      return normalizeAurora(json);
    } catch {
      return []; // dormant-safe
    }
  },
};
