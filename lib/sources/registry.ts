import type { Camera } from "@/lib/types";
import { fetchRegistry as fetchTfl } from "@/lib/sources/tfl";
import { fetchRegistry as fetchCaltrans } from "@/lib/sources/caltrans";
import { fetchRegistry as fetchScdot } from "@/lib/sources/scdot";
import { fetchRegistry as fetchDigitraffic } from "@/lib/sources/digitraffic";
import { fetchRegistry as fetchCastlerock } from "@/lib/sources/castlerock";
import { fetchRegistry as fetchTripcheck } from "@/lib/sources/tripcheck";
import { fetchRegistry as fetchDriveBc } from "@/lib/sources/drivebc";
import { findById, nearest } from "@/lib/sources/select";

const TTL_MS = 5 * 60 * 1000;
// One thunk per feed. Promise.allSettled (below) means a slow or blocked source
// degrades gracefully — the others still populate the map.
const SOURCES: Array<() => Promise<Camera[]>> = [
  fetchTfl,
  fetchCaltrans,
  fetchScdot,
  fetchDigitraffic,
  fetchCastlerock,
  fetchTripcheck,
  fetchDriveBc,
];
let cache: { cameras: Camera[]; at: number } | null = null;

export function mergeResults(
  results: PromiseSettledResult<Camera[]>[],
  staleCache: Camera[] | null,
): Camera[] {
  const cameras = results
    .filter((r): r is PromiseFulfilledResult<Camera[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
  if (cameras.length === 0) {
    if (staleCache && staleCache.length > 0) return staleCache;
    throw new Error("all camera sources failed and no cache is available");
  }
  return cameras;
}

export async function getRegistry(): Promise<Camera[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cameras;
  const results = await Promise.allSettled(SOURCES.map((f) => f()));
  const cameras = mergeResults(results, cache?.cameras ?? null);
  cache = { cameras, at: Date.now() };
  return cameras;
}

export async function getCameraById(id: string): Promise<Camera | null> {
  return findById(await getRegistry(), id);
}

export async function nearestTo(lat: number, lon: number, limit = 8) {
  return nearest(await getRegistry(), lat, lon, limit);
}
