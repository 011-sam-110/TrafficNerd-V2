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
let inflight: Promise<Camera[]> | null = null;

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

async function refresh(): Promise<Camera[]> {
  const results = await Promise.allSettled(SOURCES.map((f) => f()));
  const cameras = mergeResults(results, cache?.cameras ?? null);
  cache = { cameras, at: Date.now() };
  return cameras;
}

// Stale-while-revalidate: a fresh cache returns instantly; a stale cache returns
// instantly too while a single shared refresh runs in the background. Only the
// very first (cold) call, with no cache at all, waits for the fetch — important
// now that Castle Rock pages ~100 requests and a cold load can take ~40s.
export async function getRegistry(): Promise<Camera[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cameras;
  if (!inflight) {
    inflight = refresh()
      .catch((e) => {
        if (!cache) throw e; // cold + total failure → surface the error
        return cache.cameras; // otherwise keep serving stale
      })
      .finally(() => {
        inflight = null;
      });
  }
  return cache ? cache.cameras : inflight;
}

export async function getCameraById(id: string): Promise<Camera | null> {
  return findById(await getRegistry(), id);
}

export async function nearestTo(lat: number, lon: number, limit = 8) {
  return nearest(await getRegistry(), lat, lon, limit);
}
