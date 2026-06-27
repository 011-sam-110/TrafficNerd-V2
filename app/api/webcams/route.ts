import { getWebcams } from "@/lib/webcams/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/webcams — a global sample of Windy webcams as thin markers (the
 * x-windy-api-key is added server-side, deep in fetchWebcams; it never reaches
 * the client). Distinct from /api/cameras: webcams are their own layer and never
 * fold into the road-camera count.
 *
 * Image URLs are intentionally omitted here — their tokens are short-lived, so
 * the dossier re-resolves a fresh image per view through /api/webcam-image.
 *
 * Returns {count, webcams[]}. When the key is missing fetchWebcams returns [],
 * so this responds with an empty list (dormant) rather than crashing.
 */
export async function GET() {
  const webcams = await getWebcams();
  const thin = webcams.map((w) => ({
    id: w.id,
    title: w.title,
    lat: w.lat,
    lon: w.lon,
    country: w.country,
    region: w.region,
    available: w.available,
    detailUrl: w.detailUrl,
  }));
  return Response.json({ count: thin.length, webcams: thin });
}
