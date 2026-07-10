import { parseAdvisory, type AdvisoryPayload, type AdvisoryView } from "@/lib/geo/travelAdvisory";

export const dynamic = "force-dynamic";

// Country travel advisory — GET /api/advisory?iso2=XX.
//
// Keyless + dormant-safe: proxies travel-advisory.info's aggregate 0–5 advisory
// score for one country (server-side, avoiding client CORS) and returns the parsed
// view. On ANY failure — bad code, upstream down, unparseable — it responds
// { advisory: null } (200), never a 5xx, so the dossier slot falls back to a
// labelled placeholder. A short per-country cache shields the upstream.

interface Cached {
  at: number;
  view: AdvisoryView | null;
}
const cache = new Map<string, Cached>();
const TTL_MS = 6 * 60 * 60 * 1000; // advisories change slowly; 6h is ample
const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";

export async function GET(req: Request) {
  const iso2 = (new URL(req.url).searchParams.get("iso2") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2)) return Response.json({ advisory: null });

  const hit = cache.get(iso2);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json({ advisory: hit.view });

  let view: AdvisoryView | null = null;
  try {
    const res = await fetch(`https://www.travel-advisory.info/api?countrycode=${iso2}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const json = (await res.json()) as AdvisoryPayload;
      view = parseAdvisory(json, iso2);
    }
  } catch {
    view = hit?.view ?? null; // keep last-good if we had one
  }
  cache.set(iso2, { at: Date.now(), view });
  return Response.json({ advisory: view });
}
