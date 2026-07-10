// Shared recon target — what the six OSINT tools resolve. A target is a domain,
// an IP (v4 or v6), or an ASN; anything unusable reads as "empty" so the widgets
// show an honest "enter a domain or IP" prompt rather than firing junk at upstreams.
// Pure + node-testable — no fetch, no React.

export type TargetKind = "domain" | "ip" | "asn" | "empty";

/** IPv4 dotted-quad (each octet 0–255). */
function isIpv4(s: string): boolean {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((o) => Number(o) <= 255);
}

/** Loose IPv6 (hex groups + "::" compression) — enough to route to the IP tools. */
function isIpv6(s: string): boolean {
  if (!s.includes(":")) return false;
  if (!/^[0-9a-f:]+$/i.test(s)) return false;
  const parts = s.split("::");
  if (parts.length > 2) return false; // at most one "::"
  return s.split(":").every((g) => g === "" || /^[0-9a-f]{1,4}$/i.test(g));
}

/** Domain: dotted labels ending in an alphabetic TLD (a-z, ≥2), no scheme/path/space. */
function isDomain(s: string): boolean {
  if (s.length > 253 || /[\s/@:]/.test(s)) return false;
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(s);
}

/** Classify a raw target string. Trims + lower-cases hostnames; empty/junk → "empty". */
export function detectKind(input: string | null | undefined): TargetKind {
  const t = (input ?? "").trim().replace(/\.$/, ""); // tolerate a trailing dot (FQDN)
  if (!t) return "empty";
  if (isIpv4(t) || isIpv6(t)) return "ip";
  if (/^as\d{1,10}$/i.test(t) || /^\d{1,10}$/.test(t)) return "asn"; // "AS15169" or bare "15169"
  if (isDomain(t)) return "domain";
  return "empty"; // unusable — don't fire a lookup at garbage
}

/** Normalise a target for use in a URL/lookup: trimmed, lower-cased, AS-prefix stripped for asn. */
export function normalizeTarget(input: string, kind: TargetKind): string {
  const t = (input ?? "").trim().replace(/\.$/, "");
  if (kind === "asn") return t.replace(/^as/i, "");
  if (kind === "domain" || kind === "ip") return t.toLowerCase();
  return t;
}
