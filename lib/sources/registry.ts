import type { Camera } from "@/lib/types";
import { fetchRegistry } from "@/lib/sources/tfl";
import { findById, nearest } from "@/lib/sources/select";

const TTL_MS = 5 * 60 * 1000;
let cache: { cameras: Camera[]; at: number } | null = null;

export async function getRegistry(): Promise<Camera[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cameras;
  const cameras = await fetchRegistry();
  cache = { cameras, at: Date.now() };
  return cameras;
}

export async function getCameraById(id: string): Promise<Camera | null> {
  return findById(await getRegistry(), id);
}

export async function nearestTo(lat: number, lon: number, limit = 8) {
  return nearest(await getRegistry(), lat, lon, limit);
}
