// BGP / ASN routing via BGPView (`api.bgpview.io`, JSON). Keyless. The route hits
// /ip/<ip> (announcing prefixes + origin ASN) or /asn/<number> (holder + RIR);
// these PURE mappers turn one BGPView JSON response into one typed result.
// No fetch, no React → fast unit tests. Robust to status!=="ok" / missing / empty.

/** One announcing prefix, flattened to the fields the widget shows. */
export interface BgpPrefix {
  prefix: string;
  /** Origin ASN number, or null when BGPView omits it. */
  asn: number | null;
  /** Human holder — the origin ASN's name (falls back to its description). */
  holder: string;
  /** Prefix registration country (ISO-2), "" when unknown. */
  country: string;
}

/** Unified result for both target kinds — optional fields are absent when N/A. */
export interface BgpResult {
  ok: boolean;
  kind: "ip" | "asn";
  /** IP lookups: the queried IP + its PTR record. */
  ip?: string;
  ptr?: string;
  /** Summary ASN/name/country — from the first prefix (IP) or the ASN itself. */
  asn?: number;
  name?: string;
  country?: string;
  /** ASN lookups: short description, homepage, allocating RIR. */
  description?: string;
  website?: string;
  rir?: string;
  /** Announcing prefixes (IP lookups); always [] for ASN lookups. */
  prefixes: BgpPrefix[];
}

/** BGPView origin-ASN reference nested inside a prefix. */
interface BgpAsnRef {
  asn?: number;
  name?: string;
  description?: string;
  country_code?: string;
}

/** BGPView prefix object (from /ip/<ip> → data.prefixes[]). */
interface BgpPrefixRaw {
  prefix?: string;
  ip?: string;
  cidr?: number;
  asn?: BgpAsnRef;
  name?: string;
  description?: string;
  country_code?: string;
}

/** BGPView /ip/<ip> response envelope. */
export interface BgpIpResponse {
  status?: string;
  data?: {
    ip?: string;
    ptr_record?: string | null;
    prefixes?: BgpPrefixRaw[];
    rir_allocation?: { rir_name?: string; country_code?: string; prefix?: string; date_allocated?: string };
    iana_assignment?: { assignment_status?: string };
  };
}

/** BGPView /asn/<number> response envelope. */
export interface BgpAsnResponse {
  status?: string;
  data?: {
    asn?: number;
    name?: string;
    description_short?: string;
    description_full?: string[];
    country_code?: string;
    website?: string;
    email_contacts?: string[];
    abuse_contacts?: string[];
    rir_allocation?: { rir_name?: string; date_allocated?: string };
    traffic_estimation?: unknown;
  };
}

/** Trimmed string, or "" for anything non-string (null/number/undefined). */
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Honest empty result — what every failure/dormant path resolves to. */
function emptyResult(kind: "ip" | "asn"): BgpResult {
  return { ok: false, kind, prefixes: [] };
}

/** Pure: one BGPView /ip response → prefixes + a lifted origin-ASN summary. */
export function parseBgpIp(json: BgpIpResponse | null | undefined): BgpResult {
  const data = json && json.status === "ok" ? json.data : undefined;
  if (!data || typeof data !== "object") return emptyResult("ip");

  const rawPrefixes: BgpPrefixRaw[] = Array.isArray(data.prefixes) ? data.prefixes : [];
  const prefixes: BgpPrefix[] = [];
  for (const p of rawPrefixes) {
    const prefix = str(p?.prefix);
    if (!prefix) continue;
    const origin = p?.asn;
    prefixes.push({
      prefix,
      asn: typeof origin?.asn === "number" ? origin.asn : null,
      holder: str(origin?.name) || str(origin?.description),
      country: str(p?.country_code),
    });
  }

  const ip = str(data.ip);
  const result: BgpResult = { ok: Boolean(ip) || prefixes.length > 0, kind: "ip", prefixes };
  if (ip) result.ip = ip;
  const ptr = str(data.ptr_record);
  if (ptr) result.ptr = ptr;

  // Top-level summary lifts from the FIRST prefix's origin ASN when present.
  const first = rawPrefixes[0]?.asn;
  if (first) {
    if (typeof first.asn === "number") result.asn = first.asn;
    const name = str(first.name);
    if (name) result.name = name;
    const country = str(first.country_code);
    if (country) result.country = country;
  }
  return result;
}

/** Pure: one BGPView /asn response → holder identity + allocating RIR. */
export function parseBgpAsn(json: BgpAsnResponse | null | undefined): BgpResult {
  const data = json && json.status === "ok" ? json.data : undefined;
  if (!data || typeof data !== "object") return emptyResult("asn");

  const asn = typeof data.asn === "number" ? data.asn : undefined;
  const name = str(data.name);
  const result: BgpResult = { ok: asn !== undefined || Boolean(name), kind: "asn", prefixes: [] };
  if (asn !== undefined) result.asn = asn;
  if (name) result.name = name;
  const description = str(data.description_short);
  if (description) result.description = description;
  const country = str(data.country_code);
  if (country) result.country = country;
  const website = str(data.website);
  if (website) result.website = website;
  const rir = str(data.rir_allocation?.rir_name);
  if (rir) result.rir = rir;
  return result;
}
