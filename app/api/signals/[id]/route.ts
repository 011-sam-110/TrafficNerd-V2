import { getSignal } from "@/lib/signals/registry";
import type { SignalFeature } from "@/lib/signals/types";

export const dynamic = "force-dynamic";

// Generic signals proxy: GET /api/signals/<id> → getSignal(id).fetch().
//
// Dormant-safe by construction:
//   • unknown id            → 404
//   • upstream fetch failure → the adapter resolves to [] (never throws), so we
//     respond {count:0, features:[]} — never a 5xx.
// A short per-id server cache (keyed to the source's own refreshMs) shields the
// upstream from bursts when several clients toggle the same layer.

interface Cached {
  at: number;
  features: SignalFeature[];
}
const cache = new Map<string, Cached>();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = getSignal(id);
  if (!source) return new Response("unknown signal", { status: 404 });

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < source.refreshMs) {
    return Response.json({ count: hit.features.length, features: hit.features });
  }

  let features: SignalFeature[] = [];
  try {
    features = await source.fetch();
  } catch {
    // Belt-and-braces: a misbehaving adapter must never surface as a 5xx.
    features = hit?.features ?? [];
  }
  cache.set(id, { at: Date.now(), features });
  return Response.json({ count: features.length, features });
}
