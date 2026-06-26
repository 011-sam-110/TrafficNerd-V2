import { getRegistry } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const cams = await getRegistry();
  // source + mediaType let the client pick the right camera icon (shape = feed,
  // colour = region); country is carried for the US-cameras work.
  const cameras = cams.map((c) => ({
    id: c.id, name: c.name, lat: c.lat, lon: c.lon, available: c.available,
    source: c.source, country: c.country, mediaType: c.mediaType,
  }));
  return Response.json({ count: cameras.length, cameras });
}
