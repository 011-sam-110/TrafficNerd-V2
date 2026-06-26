import { fetchStates, DEFAULT_BBOX } from "@/lib/sources/opensky";
import type { OpenSkyBbox } from "@/lib/sources/opensky";

export const dynamic = "force-dynamic";

/**
 * GET /api/planes
 *
 * Optional query params: south, west, north, east (floats).
 * Falls back to UK+Ireland bbox when any are absent or invalid.
 *
 * Response: { count: number, planes: Plane[] }
 *
 * Rate-limiting and error handling is done inside fetchStates; this route
 * never throws — it returns the last good cache or an empty array.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  function qp(name: string, fallback: number): number {
    const raw = searchParams.get(name);
    if (raw === null) return fallback;
    const v = parseFloat(raw);
    return isFinite(v) ? v : fallback;
  }

  const bbox: OpenSkyBbox = {
    south: qp("south", DEFAULT_BBOX.south),
    west: qp("west", DEFAULT_BBOX.west),
    north: qp("north", DEFAULT_BBOX.north),
    east: qp("east", DEFAULT_BBOX.east),
  };

  const planes = await fetchStates(bbox);
  return Response.json({ count: planes.length, planes });
}
