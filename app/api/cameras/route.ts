import { getRegistry } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const cams = await getRegistry();
  const cameras = cams.map((c) => ({
    id: c.id, name: c.name, lat: c.lat, lon: c.lon, available: c.available,
  }));
  return Response.json({ count: cameras.length, cameras });
}
