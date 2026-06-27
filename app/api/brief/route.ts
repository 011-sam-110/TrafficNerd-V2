import { buildBriefPrompt, parseBriefResponse, type BriefPayload, type BriefSnapshot } from "@/lib/brief";
import { INSTABILITY_SOURCE } from "@/lib/signals/instability";

export const dynamic = "force-dynamic";

// GET /api/brief — an AI-written daily world brief, grounded ONLY in the live
// Country Instability Index. Key-gated on freellmapi.co (Sampo's gateway):
// dormant ({brief:null, dormant:true}) until FREELLMAPI_BASE_URL + FREELLMAPI_KEY
// are set. Cached ~30 min. Dormant-safe: any failure returns dormant, never a 5xx.

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: BriefPayload | null = null;

async function buildSnapshot(): Promise<BriefSnapshot> {
  const feats = await INSTABILITY_SOURCE.fetch(); // already ranked, densest first
  const topInstability = feats.slice(0, 6).map((f) => ({
    country: String(f.props?.country ?? f.title ?? "").trim(),
    score: Number(f.props?.score ?? 0),
  }));
  return { topInstability, dateIso: new Date().toISOString().slice(0, 10) };
}

export async function GET() {
  const base = (process.env.FREELLMAPI_BASE_URL ?? "").trim().replace(/\/$/, "");
  const key = (process.env.FREELLMAPI_KEY ?? "").trim();
  if (!base || !key) {
    return Response.json({ brief: null, dormant: true, generatedAt: Date.now() } satisfies BriefPayload);
  }
  if (cache && Date.now() - cache.generatedAt < CACHE_TTL_MS) {
    return Response.json(cache);
  }
  try {
    const snapshot = await buildSnapshot();
    const prompt = buildBriefPrompt(snapshot);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 220,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const brief = parseBriefResponse(await res.json());
    cache = { brief, dormant: false, generatedAt: Date.now() };
  } catch {
    cache = { brief: null, dormant: false, generatedAt: Date.now() };
  }
  return Response.json(cache);
}
