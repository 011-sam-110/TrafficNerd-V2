import { getRegistry } from "@/lib/sources/registry";
import { isLiveStreamUrl } from "@/lib/proxy/hls-allowlist";

export const dynamic = "force-dynamic";

export async function GET() {
  const cams = await getRegistry();
  // source + live let the client pick the right camera icon (shape = feed,
  // colour = region). `live` = has a stream our /api/hls proxy can play, so the
  // video icon means genuinely-playable live video (not just any mediaType).
  const cameras = cams.map((c) => ({
    id: c.id, name: c.name, lat: c.lat, lon: c.lon, available: c.available,
    source: c.source, country: c.country, live: isLiveStreamUrl(c.streamUrl),
    // Enriched for the focus view (Camera fields the docked widget doesn't need).
    // NOTE: deliberately NO imageUrl/streamUrl — snapshots go through /api/proxy?id=
    // and /api/hls?id= (SSRF allowlist by id), never a raw upstream URL.
    region: c.region, road: c.road, refreshSeconds: c.refreshSeconds,
    attribution: c.attribution, license: c.license, lastSampledAt: c.lastSampledAt,
  }));
  return Response.json({ count: cameras.length, cameras });
}
