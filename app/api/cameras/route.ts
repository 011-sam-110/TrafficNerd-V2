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
  }));
  return Response.json({ count: cameras.length, cameras });
}
