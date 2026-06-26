// Classify an aircraft into a coarse *type* from its live flight profile.
//
// IMPORTANT: the anonymous OpenSky feed carries no aircraft-category field, so
// this is an honest *inference* from altitude + ground speed + on-ground state,
// not a lookup. It is good enough to differentiate the obvious cases (a hovering
// helicopter vs a cruising airliner) and is surfaced in the UI as an estimate.
// Pure + unit-tested.

export type PlaneCategory = "airliner" | "regional" | "light" | "helicopter" | "ground";

export interface PlaneProfile {
  /** Altitude above sea level in kilometres. */
  altKm: number;
  /** Ground speed in m/s, or null when unknown. */
  velocityMs: number | null;
  /** True when the aircraft reports itself on the ground. */
  onGround: boolean;
}

// Thresholds (kept named so the heuristic is legible).
const HELI_ALT_KM = 1.5; //  helicopters work low …
const HELI_SPEED_MS = 70; //  … and slow (~135 kt)
const AIRLINER_ALT_KM = 7; // jets cruise high …
const AIRLINER_SPEED_MS = 150; // … and fast (~290 kt)
const REGIONAL_ALT_KM = 3; // turboprops / regional jets mid-band
const REGIONAL_SPEED_MS = 110;

/** Coarse aircraft type inferred from the live flight profile. */
export function classifyPlane(p: PlaneProfile): PlaneCategory {
  if (p.onGround) return "ground";
  const alt = Number.isFinite(p.altKm) ? p.altKm : 0;
  const v = p.velocityMs ?? 0;
  if (alt < HELI_ALT_KM && v < HELI_SPEED_MS) return "helicopter";
  if (alt >= AIRLINER_ALT_KM && v >= AIRLINER_SPEED_MS) return "airliner";
  if (alt >= REGIONAL_ALT_KM || v >= REGIONAL_SPEED_MS) return "regional";
  return "light";
}
