// app/api/news/synthesis/route.ts
import {
  buildSynthesisPrompt,
  parseSynthesisResponse,
  synthesisKey,
  type SynthesisInput,
  type SynthesisPayload,
  type SynthesisSource,
} from "@/lib/news/synthesis";
import { freellmConfig } from "@/lib/geolocate/config";

export const dynamic = "force-dynamic";

// POST /api/news/synthesis { title, sources:[{source,title,description?}] } — a
// neutral cross-source synthesis of a clustered story (consensus + discrepancies).
// Grounded ONLY in the supplied headlines (no article fetch → no SSRF surface).
// Dormant ({synthesis:null, dormant:true}) until FREELLMAPI_* is set. Dormant-safe:
// any failure returns JSON, never a 5xx. Cached per cluster signature.

const cache = new Map<string, SynthesisPayload>();

function payload(p: SynthesisPayload): Response {
  return Response.json(p);
}

function normalizeSources(raw: unknown): SynthesisSource[] {
  if (!Array.isArray(raw)) return [];
  const out: SynthesisSource[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const source = typeof o.source === "string" ? o.source : "";
    const title = typeof o.title === "string" ? o.title : "";
    if (!source || !title) continue;
    const description = typeof o.description === "string" ? o.description.slice(0, 400) : undefined;
    out.push({ source, title: title.slice(0, 300), description });
    if (out.length >= 8) break; // cap prompt size
  }
  return out;
}

export async function POST(req: Request) {
  let body: { title?: unknown; sources?: unknown };
  try {
    body = await req.json();
  } catch {
    return payload({ synthesis: null, dormant: false, sourceCount: 0 });
  }
  const title = typeof body.title === "string" ? body.title.slice(0, 300) : "";
  const sources = normalizeSources(body.sources);
  const sourceCount = sources.length;

  // Cross-source synthesis only makes sense with ≥2 outlets.
  if (sourceCount < 2) return payload({ synthesis: null, dormant: false, sourceCount });

  const input: SynthesisInput = { title, sources };
  const key = synthesisKey(input);
  const cached = cache.get(key);
  if (cached) return payload(cached);

  const cfg = freellmConfig();
  if (!cfg) return payload({ synthesis: null, dormant: true, sourceCount });

  try {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: buildSynthesisPrompt(input) }],
        temperature: 0.2,
        max_tokens: 260,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    const synthesis = parseSynthesisResponse(await r.json());
    const out: SynthesisPayload = { synthesis, dormant: false, sourceCount };
    if (synthesis) cache.set(key, out);
    return payload(out);
  } catch {
    return payload({ synthesis: null, dormant: false, sourceCount });
  }
}
