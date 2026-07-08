import { fetchAircraft } from "@/lib/sources/adsb";

export const dynamic = "force-dynamic";

/**
 * GET /api/planes — live aircraft (keyless, from adsb.lol) across a coarse global
 * grid as classified WorldObjects. fetchAircraft serves a shared, stored snapshot
 * (Next Data Cache) and handles failure (empty), so this route never throws and
 * users never trigger their own upstream pull.
 *
 * Response: { count: number, planes: WorldObject[] }
 */
export async function GET() {
  const planes = await fetchAircraft();
  return Response.json({ count: planes.length, planes });
}
