import { fetchTLEs } from "@/lib/sources/celestrak";

export const dynamic = "force-dynamic";

// Returns the raw TLE set for the requested group. The client propagates these
// locally (satellite.js) so the satellites revolve smoothly instead of jumping
// on each poll. ?group=visual (default) | stations | active | starlink | ...
export async function GET(req: Request) {
  const group = new URL(req.url).searchParams.get("group") ?? "visual";
  try {
    const satellites = await fetchTLEs(group);
    return Response.json({ count: satellites.length, source: "celestrak", group, satellites });
  } catch {
    return Response.json(
      { count: 0, source: "celestrak", group, satellites: [], error: "celestrak_unavailable" },
      { status: 200 },
    );
  }
}
