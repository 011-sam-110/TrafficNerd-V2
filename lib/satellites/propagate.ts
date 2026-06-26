// Pure, isomorphic SGP4 propagation helpers (used by both the API route and the
// client hook, and unit-tested in isolation). satellite.js v7's classic
// propagate() path is synchronous — no WASM init needed (verified against the
// live ISS TLE: alt 423 km, v 7.66 km/s, period 92.9 min).

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from "satellite.js";
import type { SatRec } from "satellite.js";

export interface SubPoint {
  /** Sub-satellite latitude in degrees. */
  lat: number;
  /** Sub-satellite longitude in degrees. */
  lon: number;
  /** Altitude above the ellipsoid in kilometres. */
  altKm: number;
  /** Inertial speed in km/s. */
  velocityKmS: number;
}

export function buildSatrec(line1: string, line2: string): SatRec {
  return twoline2satrec(line1, line2);
}

/**
 * Propagate a satellite to `when` and return its ground sub-point + altitude.
 * Returns null if SGP4 errors or yields a non-finite result (decayed/invalid TLE).
 */
export function propagateAt(satrec: SatRec, when: Date): SubPoint | null {
  let pv;
  try {
    pv = propagate(satrec, when);
  } catch {
    return null;
  }
  if (!pv || typeof pv.position === "boolean" || !pv.position) return null;

  const gmst = gstime(when);
  const geo = eciToGeodetic(pv.position, gmst);
  const lat = degreesLat(geo.latitude);
  const lon = degreesLong(geo.longitude);
  const altKm = geo.height;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altKm)) return null;

  let velocityKmS = 0;
  if (pv.velocity && typeof pv.velocity !== "boolean") {
    const { x, y, z } = pv.velocity;
    velocityKmS = Math.sqrt(x * x + y * y + z * z);
  }
  return { lat, lon, altKm, velocityKmS };
}

/** Mean motion (revolutions/day) from TLE line 2, columns 53–63. */
export function meanMotionRevPerDay(line2: string): number {
  return parseFloat(line2.slice(52, 63));
}

/** Orbital period in minutes, derived from the TLE mean motion. */
export function orbitalPeriodMin(line2: string): number {
  const mm = meanMotionRevPerDay(line2);
  return mm > 0 ? 1440 / mm : NaN;
}
