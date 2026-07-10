// Certificate Transparency subdomains via crt.sh (`crt.sh/?q=<domain>&output=json`).
// Keyless. The route fetches the JSON array of logged certs; this PURE mapper turns
// that array into a de-duplicated subdomain list + recent-cert table. No fetch, no
// React → fast unit tests.

/** One raw crt.sh row (only the fields we read; all optional / dormant-safe). */
export interface CrtShRow {
  issuer_ca_id?: number;
  issuer_name?: string;
  common_name?: string;
  /** Newline-separated list of SANs (may include wildcards + emails). */
  name_value?: string;
  id?: number;
  entry_timestamp?: string | null;
  not_before?: string;
  not_after?: string;
  serial_number?: string;
}

export interface CertRecord {
  issuer: string;
  commonName: string;
  notBefore: string;
  notAfter: string;
}

export interface CertsResult {
  ok: boolean;
  /** Unique, alphabetically-sorted hostnames (wildcards kept as their literal string). */
  subdomains: string[];
  /** De-duplicated certs, most-recent first (by not_before), capped at 50. */
  certs: CertRecord[];
  /** Total rows seen in the upstream response. */
  total: number;
  /** subdomains.length (convenience for the widget header). */
  subdomainCount: number;
}

const MAX_CERTS = 50;

/** Trim a possibly-missing string field; non-strings → "". */
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Pure: one crt.sh JSON array → unique subdomains + recent certs. Robust to junk. */
export function parseCrtSh(rows: CrtShRow[] | null | undefined): CertsResult {
  if (!Array.isArray(rows)) {
    return { ok: false, subdomains: [], certs: [], total: 0, subdomainCount: 0 };
  }

  const names = new Set<string>();
  const certs: CertRecord[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    // Subdomains: common_name + every "\n"-split SAN, lower-cased/trimmed, no empties.
    const raw = [str(row.common_name), ...str(row.name_value).split("\n")];
    for (const n of raw) {
      const name = n.trim().toLowerCase();
      if (name) names.add(name);
    }

    // Certs: skip all-empty rows; de-dupe collapses the pre-cert/leaf pairs crt.sh logs.
    const cert: CertRecord = {
      issuer: str(row.issuer_name),
      commonName: str(row.common_name),
      notBefore: str(row.not_before),
      notAfter: str(row.not_after),
    };
    if (!cert.commonName && !cert.notBefore && !cert.notAfter) continue;
    const key = `${cert.issuer}|${cert.commonName}|${cert.notBefore}|${cert.notAfter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    certs.push(cert);
  }

  const subdomains = [...names].sort();
  // Recency-sorted (not_before desc — ISO strings compare lexically), capped.
  certs.sort((a, b) => (a.notBefore < b.notBefore ? 1 : a.notBefore > b.notBefore ? -1 : 0));
  const recent = certs.slice(0, MAX_CERTS);

  return {
    ok: subdomains.length > 0 || recent.length > 0,
    subdomains,
    certs: recent,
    total: rows.length,
    subdomainCount: subdomains.length,
  };
}
