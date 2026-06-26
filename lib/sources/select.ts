import type { Camera } from "@/lib/types";
import { haversineKm } from "@/lib/geo/haversine";

export function findById(cams: Camera[], id: string): Camera | null {
  return cams.find((c) => c.id === id) ?? null;
}

export function nearest(
  cams: Camera[],
  lat: number,
  lon: number,
  limit: number,
): { camera: Camera; km: number }[] {
  return cams
    .map((camera) => ({ camera, km: haversineKm(lat, lon, camera.lat, camera.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export function search(cams: Camera[], q: string): Camera[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return cams;
  return cams.filter((c) => c.name.toLowerCase().includes(needle));
}
