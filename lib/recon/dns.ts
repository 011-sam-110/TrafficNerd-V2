// DNS records via DNS-over-HTTPS (Cloudflare `cloudflare-dns.com/dns-query`, JSON).
// Keyless. The route queries the useful record types; this PURE mapper turns one
// DoH JSON response into typed records. No fetch, no React → fast unit tests.

export type DnsType = "A" | "AAAA" | "MX" | "NS" | "TXT" | "CNAME" | "SOA" | "CAA";

/** The record types the DNS tool asks for, in display order. */
export const DNS_TYPES: DnsType[] = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA", "CAA"];

/** DoH numeric rr-type ⇄ name (only the types we surface). */
const NUM_TO_TYPE: Record<number, DnsType> = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA", 257: "CAA" };
export const TYPE_TO_NUM: Record<DnsType, number> = { A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16, CNAME: 5, SOA: 6, CAA: 257 };

export interface DohResponse {
  Status?: number;
  Answer?: { name?: string; type?: number; TTL?: number; data?: string }[];
}

export interface DnsRecord {
  type: DnsType;
  name: string;
  ttl: number;
  value: string;
}

export interface DnsResult {
  ok: boolean;
  records: DnsRecord[];
  /** DoH Status (0 = NOERROR, 3 = NXDOMAIN); null when unknown. */
  status: number | null;
}

/** Pure: one DoH JSON response → typed records (unknown rr-types are dropped). */
export function parseDoh(json: DohResponse | null | undefined): DnsRecord[] {
  const answers = json?.Answer;
  if (!Array.isArray(answers)) return [];
  const out: DnsRecord[] = [];
  for (const a of answers) {
    const type = typeof a?.type === "number" ? NUM_TO_TYPE[a.type] : undefined;
    const value = typeof a?.data === "string" ? a.data.trim() : "";
    if (!type || !value) continue;
    out.push({
      type,
      name: typeof a?.name === "string" ? a.name.replace(/\.$/, "") : "",
      ttl: typeof a?.TTL === "number" ? a.TTL : 0,
      value,
    });
  }
  return out;
}

/** Pure: merge the per-type DoH responses (type → json) into one ordered result. */
export function buildDnsResult(byType: Partial<Record<DnsType, DohResponse>>): DnsResult {
  const records: DnsRecord[] = [];
  let status: number | null = null;
  for (const t of DNS_TYPES) {
    const json = byType[t];
    if (!json) continue;
    if (status == null && typeof json.Status === "number") status = json.Status;
    records.push(...parseDoh(json));
  }
  return { ok: records.length > 0, records, status };
}
