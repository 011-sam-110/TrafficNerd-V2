// Pure helpers for the country dossier's "Instability index" section.
//
// The Country Instability Index (CII) is already computed per-country by
// lib/signals/instability.ts and served via /api/signals/instability. Each
// feature has id `cii:<ISO3>` and props carrying { country, score, drivers,
// coverage, magnitude, ...per-factor breakdown }. This module's only job is to
// match a clicked country to its CII feature and shape it for display — no DOM,
// no fetching, so it is fully unit-testable.

import type { SignalFeature } from "@/lib/signals/types";
import type { FeedStatus } from "@/lib/widgets/useSignalFeatures";

// The CII source spreads a per-factor breakdown (label → "NN%") straight into
// props alongside these fixed keys. Everything NOT in this set (and shaped like a
// percentage) is a factor contribution.
const RESERVED_PROP_KEYS = new Set(["country", "score", "drivers", "coverage", "magnitude"]);

export interface InstabilityFactor {
  /** Human factor label, e.g. "armed conflict". */
  label: string;
  /** Raw display value from the source, e.g. "80%". */
  value: string;
  /** Parsed 0..100 magnitude for the mini bar (0 if unparseable). */
  pct: number;
}

export interface CountryInstabilityView {
  /** Composite score 0..100. */
  score: number;
  /** Ramp colour the source assigned to this score. */
  color: string;
  /** Top drivers, ordered by weighted contribution (densest first). */
  drivers: string[];
  /** Per-factor breakdown, ordered to match the drivers. */
  factors: InstabilityFactor[];
  /** Factor coverage, e.g. "3/4 factors". */
  coverage: string;
}

/** The ISO-3 embedded in a CII feature id ("cii:SYR" → "SYR"), else null. */
export function featureIso3(feature: SignalFeature): string | null {
  const [ns, code] = String(feature?.id ?? "").split(":");
  return ns === "cii" && code ? code.toUpperCase() : null;
}

/**
 * Find the CII feature for a clicked country: by ISO-3 first (via the `cii:<ISO3>`
 * id), then falling back to a case-insensitive country-name === label match.
 * Returns null when nothing matches (e.g. the country is below the CII threshold).
 */
export function findInstabilityFeature(
  features: SignalFeature[],
  iso3: string | undefined,
  label: string | undefined,
): SignalFeature | null {
  if (!Array.isArray(features) || features.length === 0) return null;

  const wantIso = iso3?.trim().toUpperCase() || null;
  if (wantIso) {
    const byIso = features.find((f) => featureIso3(f) === wantIso);
    if (byIso) return byIso;
  }

  const wantLabel = label?.trim().toLowerCase() || null;
  if (wantLabel) {
    const byName = features.find(
      (f) => String(f.props?.country ?? "").trim().toLowerCase() === wantLabel,
    );
    if (byName) return byName;
  }

  return null;
}

/** Shape a matched CII feature into the dossier view-model. Pure. */
export function deriveInstabilityView(feature: SignalFeature): CountryInstabilityView {
  const props = feature.props ?? {};
  const score = Number(props.score ?? 0);

  const drivers = String(props.drivers ?? "")
    .split("›")
    .map((s) => s.trim())
    .filter(Boolean);

  // Order the breakdown to mirror the drivers (weighted contribution) ordering.
  const rank = new Map(drivers.map((d, i) => [d, i] as const));
  const factors: InstabilityFactor[] = Object.entries(props)
    .filter(([k, v]) => !RESERVED_PROP_KEYS.has(k) && typeof v === "string" && /%\s*$/.test(v))
    .map(([label, v]) => ({
      label,
      value: String(v),
      pct: Number(String(v).replace(/[^0-9.]/g, "")) || 0,
    }))
    .sort((a, b) => (rank.get(a.label) ?? 99) - (rank.get(b.label) ?? 99));

  return {
    score,
    color: feature.color ?? "#dc2626",
    drivers,
    factors,
    coverage: String(props.coverage ?? ""),
  };
}

/** The rendering state for the country dossier's instability slot. */
export type CountryInstabilityState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "below" }
  | { kind: "scored"; view: CountryInstabilityView };

/**
 * Resolve what the instability slot should show. Honest about the difference
 * between "this country is genuinely below the threshold" (feed has data, no
 * match) and "we have no data right now" (feed empty / errored), so we never
 * fake a "Stable" verdict when the monitor is simply dormant.
 */
export function resolveCountryInstability(
  features: SignalFeature[],
  status: FeedStatus,
  iso3: string | undefined,
  label: string | undefined,
): CountryInstabilityState {
  const match = findInstabilityFeature(features, iso3, label);
  if (match) return { kind: "scored", view: deriveInstabilityView(match) };
  if (status === "error") return { kind: "error" };
  if (features.length === 0) return status === "loading" ? { kind: "loading" } : { kind: "empty" };
  return { kind: "below" };
}
