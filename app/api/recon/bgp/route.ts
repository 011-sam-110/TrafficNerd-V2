import { NextRequest } from "next/server";
import { detectKind, normalizeTarget } from "@/lib/recon/target";
import { parseBgpIp, parseBgpAsn, type BgpResult, type BgpIpResponse, type BgpAsnResponse } from "@/lib/recon/bgp";

// GET /api/recon/bgp?target=<ip|asn> — BGP / ASN routing via BGPView (keyless JSON).
// IP → /ip/<ip> (announcing prefixes + origin ASN); ASN → /asn/<number> (holder + RIR).
// Dormant-safe: any upstream/parse failure → { ok:false } with an empty result + HTTP 200.
export const revalidate = 300; // 5-minute edge cache per target

const BGPVIEW = "https://api.bgpview.io";

function empty(kind: "ip" | "asn", reason: string, target: string) {
  return Response.json({ ok: false, kind, prefixes: [], reason, target });
}

export async function GET(req: NextRequest) {
  const target = (req.nextUrl.searchParams.get("target") ?? "").trim();
  const kind = detectKind(target);
  if (kind !== "ip" && kind !== "asn") {
    return empty("ip", "BGP needs an IP or ASN target.", target);
  }
  const id = encodeURIComponent(normalizeTarget(target, kind));
  const path = kind === "ip" ? `/ip/${id}` : `/asn/${id}`;
  try {
    const res = await fetch(`${BGPVIEW}${path}`, {
      headers: { accept: "application/json", "user-agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return empty(kind, "BGP lookup failed.", target);
    const json = await res.json();
    const result: BgpResult = kind === "ip" ? parseBgpIp(json as BgpIpResponse) : parseBgpAsn(json as BgpAsnResponse);
    return Response.json({ ...result, target });
  } catch {
    return empty(kind, "BGP lookup failed.", target);
  }
}
