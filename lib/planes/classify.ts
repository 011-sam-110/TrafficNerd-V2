// Classify an aircraft into a coarse *type*.
//
// PREFERRED: the ADS-B emitter category (adsb.lol's `category`, e.g. A7 = rotor-
// craft, A5 = heavy) — an actual broadcast field, not a guess. FALLBACK: when no
// category is present we infer from altitude + ground speed + on-ground state
// (an honest estimate, surfaced in the UI as "est."). Pure + unit-tested.

export type PlaneCategory = "airliner" | "regional" | "light" | "helicopter" | "ground";

export interface PlaneProfile {
  /** Altitude above sea level in kilometres. */
  altKm: number;
  /** Ground speed in m/s, or null when unknown. */
  velocityMs: number | null;
  /** True when the aircraft reports itself on the ground. */
  onGround: boolean;
  /** ADS-B emitter category (A0–A7, B0–B7…) when known. */
  category?: string;
}

// ADS-B emitter category → our coarse type (the reliable path).
const ADSB_CATEGORY: Record<string, PlaneCategory> = {
  A1: "light", // light (<15500 lbs)
  A2: "regional", // small
  A3: "airliner", // large
  A4: "airliner", // high-vortex large (B757)
  A5: "airliner", // heavy
  A7: "helicopter", // rotorcraft
  B1: "light", // glider/sailplane
  B4: "light", // ultralight
};

// Thresholds (kept named so the heuristic is legible).
const HELI_ALT_KM = 1.5; //  helicopters work low …
const HELI_SPEED_MS = 70; //  … and slow (~135 kt)
const AIRLINER_ALT_KM = 7; // jets cruise high …
const AIRLINER_SPEED_MS = 150; // … and fast (~290 kt)
const REGIONAL_ALT_KM = 3; // turboprops / regional jets mid-band
const REGIONAL_SPEED_MS = 110;

/** Coarse aircraft type — prefers the ADS-B category, else the flight profile. */
export function classifyPlane(p: PlaneProfile): PlaneCategory {
  if (p.onGround) return "ground";
  if (p.category && ADSB_CATEGORY[p.category]) return ADSB_CATEGORY[p.category];
  const alt = Number.isFinite(p.altKm) ? p.altKm : 0;
  const v = p.velocityMs ?? 0;
  if (alt < HELI_ALT_KM && v < HELI_SPEED_MS) return "helicopter";
  if (alt >= AIRLINER_ALT_KM && v >= AIRLINER_SPEED_MS) return "airliner";
  if (alt >= REGIONAL_ALT_KM || v >= REGIONAL_SPEED_MS) return "regional";
  return "light";
}
