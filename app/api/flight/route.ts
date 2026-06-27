import { fetchFlightRoute, fetchAircraftInfo, type FlightEnrichment } from "@/lib/sources/adsbdb";

export const dynamic = "force-dynamic";

/**
 * GET /api/flight?callsign=BAW117&hex=A835AF — server-side adsbdb enrichment for
 * one flight. Proxies adsbdb so the client never calls it (no CORS), with a short
 * in-memory cache. Either param is optional; missing/unknown ids resolve to null
 * so the dossier degrades gracefully. Never throws (dormant-safe).
 *
 * Response: { route: FlightRoute | null, aircraft: AircraftInfo | null }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const callsign = searchParams.get("callsign")?.trim() ?? "";
  const hex = searchParams.get("hex")?.trim() ?? "";

  const [route, aircraft] = await Promise.all([
    callsign ? fetchFlightRoute(callsign) : Promise.resolve(null),
    hex ? fetchAircraftInfo(hex) : Promise.resolve(null),
  ]);

  const body: FlightEnrichment = { route, aircraft };
  return Response.json(body);
}
