// Pure TLE (two-line element) parsing → the orbital vitals the console shows.
// Fixed-column format (1-indexed cols per the NORAD spec); eccentricity has an
// implied leading decimal. Derived apogee/perigee from mean motion + eccentricity.
export interface OrbitalElements {
  inclinationDeg: number;
  raanDeg: number;          // right ascension of the ascending node
  eccentricity: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
  periodMin: number;
  semiMajorAxisKm: number;
  apogeeKm: number;         // above Earth's surface
  perigeeKm: number;
}

const GM_EARTH = 398600.4418; // km^3 / s^2
const R_EARTH = 6378.137;     // km (equatorial)

function n(s: string): number { const v = Number(s.trim()); return Number.isFinite(v) ? v : 0; }

/** Parse TLE line 2 into orbital elements (line 1 gives epoch/drag, not needed here). */
export function parseElements(line1: string, line2: string): OrbitalElements | null {
  if (!line2 || line2.length < 63 || line2[0] !== "2") return null;
  const inclinationDeg = n(line2.slice(8, 16));
  const raanDeg = n(line2.slice(17, 25));
  const eccentricity = n(`0.${line2.slice(26, 33).trim()}`); // implied leading "0."
  const argPerigeeDeg = n(line2.slice(34, 42));
  const meanAnomalyDeg = n(line2.slice(43, 51));
  const meanMotionRevPerDay = n(line2.slice(52, 63));
  const periodMin = meanMotionRevPerDay > 0 ? 1440 / meanMotionRevPerDay : 0;
  const nRadPerSec = (meanMotionRevPerDay * 2 * Math.PI) / 86400;
  const semiMajorAxisKm = nRadPerSec > 0 ? Math.cbrt(GM_EARTH / (nRadPerSec * nRadPerSec)) : 0;
  const apogeeKm = semiMajorAxisKm * (1 + eccentricity) - R_EARTH;
  const perigeeKm = semiMajorAxisKm * (1 - eccentricity) - R_EARTH;
  return { inclinationDeg, raanDeg, eccentricity, argPerigeeDeg, meanAnomalyDeg, meanMotionRevPerDay, periodMin, semiMajorAxisKm, apogeeKm, perigeeKm };
}
