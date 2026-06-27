import type { Webcam } from "@/lib/types";
import { fetchWebcams } from "@/lib/sources/windy";

// Server-side webcams cache — the Windy analogue of lib/sources/registry.ts, but
// kept DELIBERATELY SHORT (8 min, under the free-tier ~10 min image-token expiry)
// so a marker's image URL is never served stale enough to have expired. Webcams
// are a distinct layer, so this lives apart from the camera registry and never
// touches camera counts.

const TTL_MS = 8 * 60 * 1000;

let cache: { webcams: Webcam[]; at: number } | null = null;
let inflight: Promise<Webcam[]> | null = null;

async function refresh(): Promise<Webcam[]> {
  const webcams = await fetchWebcams();
  cache = { webcams, at: Date.now() };
  return webcams;
}

/**
 * Fresh-or-revalidate: a fresh cache returns instantly; a stale cache returns
 * instantly while a single shared refresh runs behind it. Only a cold call waits.
 * fetchWebcams never throws (returns [] when the key is absent), so this is safe.
 */
export async function getWebcams(): Promise<Webcam[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.webcams;
  if (!inflight) {
    inflight = refresh()
      .catch(() => cache?.webcams ?? [])
      .finally(() => {
        inflight = null;
      });
  }
  return cache ? cache.webcams : inflight;
}
