// Pure: CII SignalFeature[] → ranked instability rows for the widget. The
// instability source already sorts densest-first, but we re-sort defensively so
// the widget never depends on upstream ordering.

import type { SignalFeature } from "@/lib/signals/types";

export interface InstabilityRow {
  id: string;
  country: string;
  score: number;
  color: string;
  drivers: string;
  coverage: string;
  lat: number;
  lon: number;
  feature: SignalFeature;
}

export function instabilityRows(features: SignalFeature[], cap = 12): InstabilityRow[] {
  return features
    .filter((f) => typeof f.props?.score === "number")
    .slice()
    .sort((a, b) => Number(b.props?.score ?? 0) - Number(a.props?.score ?? 0))
    .slice(0, cap)
    .map((f) => ({
      id: f.id,
      country: String(f.props?.country ?? f.title),
      score: Number(f.props?.score ?? 0),
      color: f.color ?? "#dc2626",
      drivers: String(f.props?.drivers ?? ""),
      coverage: String(f.props?.coverage ?? ""),
      lat: f.lat,
      lon: f.lon,
      feature: f,
    }));
}
