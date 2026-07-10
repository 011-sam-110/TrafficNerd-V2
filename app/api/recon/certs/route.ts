import { NextRequest } from "next/server";
import { detectKind } from "@/lib/recon/target";
import { parseCrtSh, type CrtShRow } from "@/lib/recon/certs";

// GET /api/recon/certs?target=<domain> — Certificate Transparency subdomains via crt.sh
// (keyless JSON). Server-proxied (crt.sh is slow + not CORS-friendly; we cache per target).
// Dormant-safe: any upstream/parse failure → { ok:false } with an empty result + HTTP 200.
export const revalidate = 300; // 5-minute edge cache per target

const CRTSH = "https://crt.sh";

export async function GET(req: NextRequest) {
  const target = (req.nextUrl.searchParams.get("target") ?? "").trim();
  if (detectKind(target) !== "domain") {
    return Response.json({ ok: false, reason: "Certificate search needs a domain target.", subdomains: [], certs: [], total: 0, subdomainCount: 0, target });
  }
  try {
    const res = await fetch(`${CRTSH}/?q=${encodeURIComponent(target)}&output=json`, {
      headers: { accept: "application/json", "user-agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return Response.json({ ok: false, reason: "crt.sh lookup failed.", subdomains: [], certs: [], total: 0, subdomainCount: 0, target });
    }
    const rows = (await res.json()) as CrtShRow[];
    const result = parseCrtSh(rows);
    return Response.json({ ...result, target });
  } catch {
    return Response.json({ ok: false, reason: "crt.sh lookup failed.", subdomains: [], certs: [], total: 0, subdomainCount: 0, target });
  }
}
