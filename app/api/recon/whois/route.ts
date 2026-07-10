import { NextRequest } from "next/server";
import { detectKind } from "@/lib/recon/target";
import { parseRdap, type RdapResponse } from "@/lib/recon/whois";

// GET /api/recon/whois?target=<domain|ip> — WHOIS via RDAP (keyless).
// rdap.org bootstraps + REDIRECTS to the authoritative registry/RIR server, so we let
// fetch follow redirects (its default; we never set redirect:"manual").
// Dormant-safe: any upstream/parse failure → { ok:false } with an empty result + HTTP 200.
export const revalidate = 300; // 5-minute edge cache per target

const RDAP = "https://rdap.org";

export async function GET(req: NextRequest) {
  const target = (req.nextUrl.searchParams.get("target") ?? "").trim();
  const kind = detectKind(target);
  if (kind !== "domain" && kind !== "ip") {
    return Response.json({ ok: false, reason: "WHOIS needs a domain or IP target.", kind: "domain", status: [], nameservers: [], target });
  }
  try {
    const res = await fetch(`${RDAP}/${kind}/${encodeURIComponent(target.toLowerCase())}`, {
      headers: { accept: "application/rdap+json", "user-agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return Response.json({ ...parseRdap(null, kind), reason: `RDAP responded ${res.status}.`, target });
    }
    const json = (await res.json()) as RdapResponse;
    const result = parseRdap(json, kind);
    return Response.json({ ...result, target });
  } catch {
    return Response.json({ ...parseRdap(null, kind), reason: "WHOIS lookup failed.", target });
  }
}
