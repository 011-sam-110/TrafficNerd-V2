// Ground-track sampling for the satellites focus view. Two pure-ish pieces:
//  1. splitAntimeridian — pure geometry, unit-tested below.
//  2. groundTrack — reuses lib/satellites/propagate.ts (buildSatrec + propagateAt,
//     the SAME SGP4 path the globe/API use) to sample ±½ period of sub-points.
//     Dormant-safe: ANY propagation error (or a non-finite period) yields [].
import { buildSatrec, propagateAt } from "@/lib/satellites/propagate";

// Pure: split a sequence of [lon, lat] points into segments wherever consecutive
// longitudes jump more than 180° (an antimeridian crossing), so a polyline renderer
// draws separate strokes instead of one horizontal streak across the whole map.
export function splitAntimeridian(points: [number, number][]): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i][0] - points[i - 1][0]) > 180) { segs.push(cur); cur = []; }
    cur.push(points[i]);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

/**
 * Sample a satellite's ground track across ±½ orbit centred on `atMs`, split at
 * the antimeridian. Returns [] on any propagation error or a non-finite period
 * (dormant-safe — a decayed/garbage TLE must never throw into the render tree).
 */
export function groundTrack(
  line1: string,
  line2: string,
  atMs: number,
  periodMin: number,
  stepSec = 60,
): [number, number][][] {
  try {
    if (!Number.isFinite(periodMin) || periodMin <= 0) return [];
    const satrec = buildSatrec(line1, line2);
    const halfMs = (periodMin * 60_000) / 2;
    const stepMs = stepSec * 1000;
    const points: [number, number][] = [];
    for (let t = atMs - halfMs; t <= atMs + halfMs; t += stepMs) {
      const sp = propagateAt(satrec, new Date(t));
      if (sp) points.push([sp.lon, sp.lat]);
    }
    return splitAntimeridian(points);
  } catch {
    return [];
  }
}
