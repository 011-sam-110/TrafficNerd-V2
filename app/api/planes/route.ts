import { fetchAircraft } from "@/lib/sources/adsb";

export const dynamic = "force-dynamic";

/**
 * GET /api/planes — live aircraft (keyless, from adsb.lol) across the camera
 * regions as classified WorldObjects. fetchAircraft handles caching + failure
 * (serves stale/empty), so this route never throws.
 *
 * Response: { count: number, planes: WorldObject[] }
 */
export async function GET() {
  const planes = await fetchAircraft(Date.now());
  return Response.json({ count: planes.length, planes });
}
