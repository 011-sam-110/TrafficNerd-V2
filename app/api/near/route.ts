import { nearestTo } from "@/lib/sources/registry";
import { isLiveStreamUrl } from "@/lib/proxy/hls-allowlist";

export const dynamic = "force-dynamic";

// "Cameras near me" — the nearest road cameras to an arbitrary point (the user's
// geolocation). Computed server-side by reusing the registry's `nearestTo`
// (haversine over the already-cached ~13k camera set) so the client never has to
// download or distance-sort the whole set. Returns thin markers + their distance
// in km; the client opens the dossier (/api/camera/[id]) on click. Never hands out
// raw upstream stream URLs — `live` just tells the UI which player to use.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (
    !Number.isFinite(lat) || !Number.isFinite(lon) ||
    lat < -90 || lat > 90 || lon < -180 || lon > 180
  ) {
    return Response.json({ error: "valid lat and lon query params are required" }, { status: 400 });
  }
  const n = Math.min(Math.max(Number(url.searchParams.get("n")) || 8, 1), 25);

  try {
    const cameras = (await nearestTo(lat, lon, n)).map(({ camera, km }) => ({
      id: camera.id,
      name: camera.name,
      lat: camera.lat,
      lon: camera.lon,
      available: camera.available,
      source: camera.source,
      live: isLiveStreamUrl(camera.streamUrl),
      km: Number(km.toFixed(2)),
    }));
    return Response.json({ origin: { lat, lon }, count: cameras.length, cameras });
  } catch {
    // Dormant-safe: registry cold + total source failure → empty, never a 5xx.
    return Response.json({ origin: { lat, lon }, count: 0, cameras: [] });
  }
}
