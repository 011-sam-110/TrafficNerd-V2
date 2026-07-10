// Pure shaping for the country dossier's "Travel advisory" slot.
//
// Source: travel-advisory.info — a keyless JSON API that aggregates government
// travel advisories (AU DFAT, CA, and others) into a single 0–5 risk score per
// country, with a plain-language message, a last-updated date and a deep link to
// that country's page. It is an AGGREGATE score, not one government's figure, and
// its `updated` date can lag — the UI states both honestly. No DOM, no fetch here,
// so the score→band mapping and the payload parsing are unit-testable.

export type AdvisoryBand = "low" | "moderate" | "high";

export interface AdvisoryView {
  iso2: string;
  name: string;
  /** Aggregate risk score, 0 (safe) … 5 (avoid). */
  score: number;
  band: AdvisoryBand;
  /** Short band label, e.g. "Low risk". */
  label: string;
  /** Status hue (theme-independent, matches the map severity swatches). */
  color: string;
  /** Plain-language advisory summary from the aggregator. */
  message: string;
  /** ISO date the aggregate was last updated (may be empty / stale). */
  updated: string;
  /** Deep link to this country's advisory page. */
  source: string;
}

interface BandSpec {
  band: AdvisoryBand;
  label: string;
  color: string;
}

/** Map a 0–5 aggregate score to a qualitative band (mirrors travel-advisory.info). */
export function advisoryBand(score: number): BandSpec {
  if (score >= 3.5) return { band: "high", label: "High risk", color: "#dc2626" };
  if (score >= 2.5) return { band: "moderate", label: "Moderate risk", color: "#ea580c" };
  return { band: "low", label: "Low risk", color: "#16a34a" };
}

interface RawAdvisory {
  score?: number;
  message?: string;
  updated?: string;
  source?: string;
}
interface RawCountry {
  iso_alpha2?: string;
  name?: string;
  advisory?: RawAdvisory;
}
export interface AdvisoryPayload {
  data?: Record<string, RawCountry>;
}

/**
 * Pure: travel-advisory.info payload → the view for one country (ISO-2), or null
 * when the country is absent or carries no usable score. Case-insensitive on the
 * ISO code; falls back to the country page URL when the row omits `source`.
 */
export function parseAdvisory(payload: AdvisoryPayload, iso2: string): AdvisoryView | null {
  const want = (iso2 ?? "").trim().toUpperCase();
  if (!want || want.length !== 2) return null;
  const data = payload?.data ?? {};
  // The API keys by upper-case ISO-2, but be tolerant of casing.
  const row =
    data[want] ??
    Object.values(data).find((c) => (c?.iso_alpha2 ?? "").toUpperCase() === want) ??
    null;
  const adv = row?.advisory;
  if (!adv || typeof adv.score !== "number" || !Number.isFinite(adv.score)) return null;

  const score = Math.max(0, Math.min(5, adv.score));
  const { band, label, color } = advisoryBand(score);
  return {
    iso2: want,
    name: row?.name?.trim() || want,
    score: Math.round(score * 10) / 10,
    band,
    label,
    color,
    message: adv.message?.trim() || "",
    updated: (adv.updated ?? "").slice(0, 10),
    source: adv.source?.trim() || "https://www.travel-advisory.info/",
  };
}
