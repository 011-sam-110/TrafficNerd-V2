// app/api/news/summary/route.ts
import { isNewsArticleUrl, extractArticleText } from "@/lib/news/article";
import { buildSummaryPrompt, parseSummaryResponse, type SummaryPayload } from "@/lib/news/summary";
import { freellmConfig } from "@/lib/geolocate/config";

export const dynamic = "force-dynamic";

// POST /api/news/summary { url, title, source } — on-demand AI summary of ONE article.
// Dormant ({summary:null, dormant:true}) until FREELLMAPI_* is set. SSRF-guarded to
// the news-publisher allowlist. Dormant-safe: any failure returns JSON, never a 5xx.
// Cached per-URL (module map) so re-opening a story is free.

const cache = new Map<string, SummaryPayload>();

function bad(): Response {
  return Response.json({ summary: null, dormant: false, source: null } satisfies SummaryPayload);
}

export async function POST(req: Request) {
  let body: { url?: unknown; title?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad();
  }
  const url = typeof body.url === "string" ? body.url : "";
  const title = typeof body.title === "string" ? body.title : "";
  const source = typeof body.source === "string" ? body.source : "";
  if (!isNewsArticleUrl(url)) return bad();

  const cached = cache.get(url);
  if (cached) return Response.json(cached);

  const cfg = freellmConfig();
  if (!cfg) {
    // Not cached — dormancy can change when the env is set.
    return Response.json({ summary: null, dormant: true, source: null } satisfies SummaryPayload);
  }

  let text = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) text = extractArticleText(await res.text());
  } catch {
    text = "";
  }
  if (text.length < 200) {
    // Blocked / paywalled / too thin — tell the client to fall back to its snippet.
    const payload: SummaryPayload = { summary: null, dormant: false, source: "snippet" };
    return Response.json(payload);
  }

  try {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: buildSummaryPrompt({ title, source, text }) }],
        temperature: 0.2,
        max_tokens: 220,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    const summary = parseSummaryResponse(await r.json());
    const payload: SummaryPayload = { summary, dormant: false, source: summary ? "ai" : "snippet" };
    if (summary) cache.set(url, payload);
    return Response.json(payload);
  } catch {
    return Response.json({ summary: null, dormant: false, source: "snippet" } satisfies SummaryPayload);
  }
}
