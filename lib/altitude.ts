// Pure altitude helpers shared by the globe's 3D-objects layer.
//
// react-globe.gl's `objectAltitude` is a RELATIVE altitude (fraction of the
// globe radius), but WorldObject.altKm carries the real-world altitude in km.
// Satellites span ~400 km (LEO) to ~36000 km (GEO); at true scale GEO would sit
// ~5.6 globe-radii out and fly off-screen, so we COMPRESS the raw altitude onto
// a small visible shell band where both LEO and GEO are distinguishable.
//
// Layering (relative altitude, small → large): cameras (~0, on surface) <
// planes (low shell) < satellites (high shell). Kept pure + unit-tested.

const SAT_ALT_MIN_KM = 300; // anything lower is clamped up (keeps log finite)
const SAT_ALT_MAX_KM = 36000; // ~GEO; higher is clamped down
const SAT_SHELL_MIN = 0.12; // LEO sits here, clearly above planes
const SAT_SHELL_MAX = 0.55; // GEO sits here, still comfortably on-screen

/**
 * Map a satellite's real orbital altitude (km) onto a compressed, visible
 * relative-altitude shell in [SAT_SHELL_MIN, SAT_SHELL_MAX].
 *
 * Logarithmic so the crowded LEO band (400–2000 km) spreads out instead of
 * bunching against the surface. Monotonic increasing and clamped, so any input
 * (including NaN/Infinity) yields a finite value inside the band.
 */
export function altKmToShell(altKm: number): number {
  const a = Number.isFinite(altKm)
    ? Math.min(Math.max(altKm, SAT_ALT_MIN_KM), SAT_ALT_MAX_KM)
    : SAT_ALT_MIN_KM;
  const frac =
    (Math.log(a) - Math.log(SAT_ALT_MIN_KM)) /
    (Math.log(SAT_ALT_MAX_KM) - Math.log(SAT_ALT_MIN_KM));
  return SAT_SHELL_MIN + (SAT_SHELL_MAX - SAT_SHELL_MIN) * frac;
}

const PLANE_ALT_MAX_KM = 13; // typical cruise ceiling
const PLANE_SHELL_MIN = 0.006; // just above the camera surface markers
const PLANE_SHELL_MAX = 0.03; // well below the satellite band (0.12+)

/**
 * Map a plane's altitude (km, ~0–13) onto a low relative-altitude shell so it
 * floats just above the road network but below every satellite. Linear,
 * monotonic, clamped.
 */
export function planeKmToShell(altKm: number): number {
  const a = Number.isFinite(altKm)
    ? Math.min(Math.max(altKm, 0), PLANE_ALT_MAX_KM)
    : 0;
  return PLANE_SHELL_MIN + (PLANE_SHELL_MAX - PLANE_SHELL_MIN) * (a / PLANE_ALT_MAX_KM);
}
