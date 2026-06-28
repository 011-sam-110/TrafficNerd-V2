// The Event spine. Every hazard signal normalizes to ONE NormalizedEvent — the
// unit the feed, the map and the dossier all read. (Named NormalizedEvent, not
// `Event`, to avoid shadowing the DOM `Event` global.)
//
// P1 severity uses ONE transparent 0–10 magnitude ramp (the shared SignalFeature
// `props.magnitude` convention). P3 (§10.3) replaces this with a per-domain,
// exposure-weighted basis — until then `severity.raw` is surfaced honestly.

export type EventType =
  | "quake" | "fire" | "disaster" | "cyclone"
  | "flood" | "storm" | "volcano" | "conflict" | "other";

export type SeverityTier = "S0" | "S1" | "S2" | "S3" | "S4";

export type GeoPrecision = "EXACT" | "CITY" | "ADMIN" | "COUNTRY_CENTROID";

export interface NormalizedEvent {
  /** Stable id (the source feature id). */
  id: string;
  type: EventType;
  /** Human, specific — reused verbatim from the source feature title. */
  title: string;
  place: { name: string };
  geo: { lat: number; lon: number; precision: GeoPrecision };
  /** ISO UTC event time; null when the source carries none (never faked). */
  occurredAt: string | null;
  /** Display tier + the raw normalized magnitude it derives from (shown, not hidden). */
  severity: { tier: SeverityTier; raw: number };
  /** Native magnitude — populated only where the unit is known-safe (P1: quakes). */
  magnitude?: { value: number; unit: string };
  /** Lightweight source credit (P1). The full Provenance object lands in P3. */
  source: { id: string; label: string; attribution: string };
  link?: string;
  /** Marker/chip colour, from the severity ramp. */
  color: string;
}

const TIER_RANK: Record<SeverityTier, number> = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4 };

export const SEVERITY_COLOR: Record<SeverityTier, string> = {
  S0: "#94a3b8",
  S1: "#eab308",
  S2: "#f97316",
  S3: "#ef4444",
  S4: "#b91c1c",
};

/** Map the shared 0–10 normalized magnitude to a display tier (interim — see header). */
export function severityTier(magnitude: number): SeverityTier {
  if (Number.isNaN(magnitude)) return "S0";
  if (magnitude >= 8) return "S4";
  if (magnitude >= 6) return "S3";
  if (magnitude >= 4) return "S2";
  if (magnitude >= 2) return "S1";
  return "S0";
}

export function severityRank(tier: SeverityTier): number {
  return TIER_RANK[tier];
}

/** Best-effort row place (P1-honest): explicit props.place → the title tail after
 *  a dash/em-dash → the whole title. Country/admin enrichment is P3. */
export function placeName(title: string, props?: Record<string, unknown>): string {
  const explicit = props?.place;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const m = title.match(/\s[—-]\s(.+)$/);
  return (m ? m[1] : title).trim();
}
