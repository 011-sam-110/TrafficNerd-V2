import { NextRequest } from "next/server";
import { detectKind } from "@/lib/recon/target";
import { parseInternetDb, type InternetDbResponse } from "@/lib/recon/ports";
import { type DohResponse } from "@/lib/recon/dns";

// GET /api/recon/ports?target=<ip|domain> — passive port intelligence via Shodan
// InternetDB (`internetdb.shodan.io/<ip>`, keyless). This reads Shodan's PRE-INDEXED
// scan data — it is NOT an active scan we perform. A domain target is first resolved
// to an IP via Cloudflare DoH (A record), then looked up.
// Dormant-safe: any upstream/parse failure → { ok:false } with an empty result + HTTP 200.
export const revalidate = 300; // 5-minute edge cache per target

const UA = "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)";
const EMPTY = { ip: "", ports: [], cpes: [], hostnames: [], vulns: [] };

/** Resolve a domain to its first A record via Cloudflare DoH. null on any failure/no-A. */
async function resolveIp(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { accept: "application/dns-json", "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as DohResponse;
    for (const a of json?.Answer ?? []) {
      // rr-type 1 = A. Take the first A record's data (a dotted-quad IPv4).
      if (a?.type === 1 && typeof a?.data === "string" && a.data.trim()) return a.data.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const target = (req.nextUrl.searchParams.get("target") ?? "").trim();
  const kind = detectKind(target);

  if (kind !== "ip" && kind !== "domain") {
    return Response.json({ ok: false, reason: "Port intel needs an IP or domain target.", target, resolvedIp: "", ...EMPTY });
  }

  try {
    let ip = target;
    if (kind === "domain") {
      const resolved = await resolveIp(target);
      if (!resolved) {
        return Response.json({ ok: false, reason: `could not resolve ${target} to an IP`, target, resolvedIp: "", ...EMPTY });
      }
      ip = resolved;
    }

    const res = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      // 404 = Shodan has no index for this IP; still an honest empty (not an error).
      return Response.json({ ok: false, reason: "no InternetDB record for this host.", target, resolvedIp: ip, ...EMPTY });
    }
    const result = parseInternetDb((await res.json()) as InternetDbResponse);
    return Response.json({ ...result, target, resolvedIp: ip });
  } catch {
    return Response.json({ ok: false, reason: "Port intel lookup failed.", target, resolvedIp: "", ...EMPTY });
  }
}
