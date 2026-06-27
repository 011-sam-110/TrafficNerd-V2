// lib/cinematic/dive.ts
// Pure camera math for the cinematic dive (SP6). No MapLibre import — so it is
// node-testable. WorldMap.diveTo feeds the result straight into map.flyTo/jumpTo.

export interface DiveTarget {
  lat: number;
  lon: number;
}

export interface DiveCameraParams {
  /** MapLibre order: [lon, lat]. */
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  /** flyTo animation length, ms. */
  duration: number;
}

/** Street-level landing zoom — close enough to read a single junction. */
export const DIVE_ZOOM = 14.5;
/** Cinematic tilt on arrival. */
export const DIVE_PITCH = 50;
/** Fly animation length, ms. Long enough to feel like a dive, short enough to skip past. */
export const DIVE_DURATION = 1500;

const MIN_ZOOM = 12;
const MAX_ZOOM = 16;
const MAX_PITCH = 60;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Normalise longitude into [-180, 180). In-range values pass through exactly
 *  (no float drift); only genuinely out-of-range values are wrapped. */
function wrapLon(lon: number): number {
  if (lon >= -180 && lon < 180) return lon;
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function computeDive(target: DiveTarget): DiveCameraParams {
  const lat = clamp(target.lat, -85, 85);
  const lon = wrapLon(target.lon);
  return {
    center: [lon, lat],
    zoom: clamp(DIVE_ZOOM, MIN_ZOOM, MAX_ZOOM),
    pitch: clamp(DIVE_PITCH, 0, MAX_PITCH),
    bearing: 0,
    duration: DIVE_DURATION,
  };
}
