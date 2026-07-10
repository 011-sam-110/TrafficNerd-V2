import { NextRequest } from "next/server";
import { detectKind } from "@/lib/recon/target";
import { DNS_TYPES, buildDnsResult, type DnsType, type DohResponse } from "@/lib/recon/dns";

// GET /api/recon/dns?target=<domain> — DNS records via Cloudflare DoH (keyless JSON).
// Server-proxied (DoH is CORS-friendly but we keep every recon tool uniform + cached).
// Dormant-safe: any upstream/parse failure → { ok:false } with an empty result + HTTP 200.
export const revalidate = 300; // 5-minute edge cache per target

const DOH = "https://cloudflare-dns.com/dns-query";

async function queryType(name: string, type: DnsType): Promise<[DnsType, DohResponse] | null> {
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json", "user-agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return [type, (await res.json()) as DohResponse];
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const target = (req.nextUrl.searchParams.get("target") ?? "").trim();
  if (detectKind(target) !== "domain") {
    return Response.json({ ok: false, reason: "DNS needs a domain target.", records: [], status: null });
  }
  try {
    const pairs = await Promise.all(DNS_TYPES.map((t) => queryType(target, t)));
    const byType: Partial<Record<DnsType, DohResponse>> = {};
    for (const p of pairs) if (p) byType[p[0]] = p[1];
    const result = buildDnsResult(byType);
    return Response.json({ ...result, target });
  } catch {
    return Response.json({ ok: false, reason: "DNS lookup failed.", records: [], status: null });
  }
}
