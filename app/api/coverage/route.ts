import { getRegistry } from "@/lib/sources/registry";
import { groupCoverage } from "@/lib/coverage";

export const dynamic = "force-dynamic";

// Honest per-source coverage: total + currently-online cameras grouped by source.
// A tiny payload (one row per source) so the Coverage panel never re-fetches the
// full ~13k-camera registry just to show counts. No streamUrls ever leave here.
export async function GET() {
  const cams = await getRegistry();
  const coverage = groupCoverage(
    cams.map((c) => ({ source: c.source, available: c.available })),
  );
  return Response.json({ generatedAt: Date.now(), ...coverage });
}
