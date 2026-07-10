import { NextRequest } from "next/server";
import { detectKind } from "@/lib/recon/target";
import { parseDoh, type DohResponse } from "@/lib/recon/dns";
import { parseThreatBaseline, providerSlots, type InternetDbResponse } from "@/lib/recon/threat";

// GET /api/recon/threat?target=<ip|domain> — threat intel / IP reputation.
// Keyless baseline = Shodan InternetDB (`tags` + `vulns`); a domain resolves to its
// first A record first. KEYED providers ride along as 🔒 locked slots (never fabricated).
// Dormant-safe: any upstream/parse failure → { ok:false } + HTTP 200, still showing the slots.
export const revalidate = 300; // 5-minute edge cache per target

const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";
const DOH = "https://cloudflare-dns.com/dns-query";
const INTERNETDB = "https://internetdb.shodan.io";

/** First A record for a domain via Cloudflare DoH (keyless JSON); null on any miss. */
async function resolveA(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { accept: "application/dns-json", "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const a = parseDoh((await res.json()) as DohResponse).find((r) => r.type === "A");
    return a ? a.value : null;
  } catch {
    return null;
  }
}

/** Shodan InternetDB for an IP. 404 = known/clean (empty baseline); throw/5xx → null. */
async function fetchInternetDb(ip: string): Promise<InternetDbResponse | null> {
  try {
    const res = await fetch(`${INTERNETDB}/${encodeURIComponent(ip)}`, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return { ip, tags: [], vulns: [] };
    if (!res.ok) return null;
    return (await res.json()) as InternetDbResponse;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const target = (req.nextUrl.searchParams.get("target") ?? "").trim();
  const kind = detectKind(target);
  const providers = providerSlots(kind, process.env);

  if (kind !== "ip" && kind !== "domain") {
    return Response.json({ ok: false, reason: "Threat intel needs an IP or domain target.", baseline: null, providers, target });
  }

  try {
    const ip = kind === "ip" ? target : await resolveA(target);
    if (!ip) {
      return Response.json({ ok: false, reason: "Could not resolve target to an IP.", baseline: null, providers, target });
    }
    const json = await fetchInternetDb(ip);
    if (!json) {
      return Response.json({ ok: false, reason: "Threat baseline lookup failed.", baseline: null, providers, target });
    }
    const baseline = parseThreatBaseline(json, ip);
    return Response.json({ ok: true, ip, baseline, providers, target });
  } catch {
    return Response.json({ ok: false, reason: "Threat lookup failed.", baseline: null, providers, target });
  }
}
