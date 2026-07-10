// WHOIS via RDAP (Registration Data Access Protocol, the structured JSON successor
// to legacy port-43 WHOIS). Keyless: the route hits rdap.org, which redirects to the
// authoritative registry/RIR server. This PURE mapper turns one RDAP JSON object into
// a flat, typed result — no fetch, no React → fast unit tests. Missing fields are
// simply omitted (never invented); a null/empty object maps to an honest empty result.

export type WhoisKind = "domain" | "ip";

/** Loose shape of an RDAP domain/ip object (only the members we surface). */
export interface RdapResponse {
  /** Domain name (RDAP `ldhName`). */
  ldhName?: unknown;
  /** RDAP object handle (registry id). */
  handle?: unknown;
  /** IP network name. */
  name?: unknown;
  /** ISO 3166 country code (IP). */
  country?: unknown;
  /** IP block bounds. */
  startAddress?: unknown;
  endAddress?: unknown;
  /** RDAP network type (IP). */
  type?: unknown;
  /** EPP/RDAP status strings. */
  status?: unknown;
  /** Related entities (registrar, registrant, abuse …). */
  entities?: unknown;
  /** Lifecycle events (registration, expiration, last changed …). */
  events?: unknown;
  /** Delegated nameservers (domain). */
  nameservers?: unknown;
}

export interface WhoisResult {
  ok: boolean;
  kind: WhoisKind;
  /** Domain: `ldhName` (lower-cased). IP: the network `name`. */
  name?: string;
  /** RDAP object handle (registry id). */
  handle?: string;
  /** EPP/RDAP status strings (may be empty). */
  status: string[];
  // --- domain ---
  /** Sponsoring registrar (entity vcard `fn`, else its handle). */
  registrar?: string;
  /** ISO date — "registration" event. */
  created?: string;
  /** ISO date — "last changed" event. */
  updated?: string;
  /** ISO date — "expiration" event. */
  expires?: string;
  /** Delegated nameservers (`ldhName`, lower-cased; may be empty). */
  nameservers: string[];
  // --- ip ---
  /** ISO 3166 country code for the allocation. */
  country?: string;
  /** `startAddress` – `endAddress` of the network block. */
  range?: string;
  /** RDAP network `type` (e.g. "ALLOCATED PA"). */
  type?: string;
  /** Registrant (else abuse) entity name if present. */
  registrant?: string;
}

/** An honest empty result — the dormant-safe baseline for a given kind. */
function emptyWhois(kind: WhoisKind): WhoisResult {
  return { ok: false, kind, status: [], nameservers: [] };
}

/** Trimmed non-empty string, or undefined. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Filter an unknown value down to a clean string[]. */
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const s of v) {
    const clean = str(s);
    if (clean) out.push(clean);
  }
  return out;
}

interface RdapEntity {
  handle?: unknown;
  roles?: unknown;
  vcardArray?: unknown;
}

/** First entity whose `roles[]` includes `role`. */
function findEntity(v: unknown, role: string): RdapEntity | undefined {
  if (!Array.isArray(v)) return undefined;
  for (const e of v) {
    const roles = (e as RdapEntity)?.roles;
    if (Array.isArray(roles) && roles.includes(role)) return e as RdapEntity;
  }
  return undefined;
}

/** Pull a jCard property (e.g. "fn") out of an entity's vcardArray. */
function vcardField(entity: RdapEntity | undefined, field: string): string | undefined {
  const arr = entity?.vcardArray;
  if (!Array.isArray(arr) || !Array.isArray(arr[1])) return undefined;
  for (const entry of arr[1]) {
    if (Array.isArray(entry) && entry[0] === field) return str(entry[3]);
  }
  return undefined;
}

/** Human name for an entity: vcard `fn`, else its handle. */
function entityName(entity: RdapEntity | undefined): string | undefined {
  if (!entity) return undefined;
  return vcardField(entity, "fn") ?? str(entity.handle);
}

/** Map RDAP `events[]` to the dates we surface (first of each action wins). */
function mapEvents(v: unknown): { created?: string; updated?: string; expires?: string } {
  const out: { created?: string; updated?: string; expires?: string } = {};
  if (!Array.isArray(v)) return out;
  for (const e of v) {
    const action = str((e as { eventAction?: unknown })?.eventAction)?.toLowerCase();
    const date = str((e as { eventDate?: unknown })?.eventDate);
    if (!action || !date) continue;
    if (action === "registration" && !out.created) out.created = date;
    else if (action === "expiration" && !out.expires) out.expires = date;
    else if (action === "last changed" && !out.updated) out.updated = date;
  }
  return out;
}

/** Delegated nameserver hostnames (`ldhName`), lower-cased. */
function mapNameservers(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const ns of v) {
    const ldh = str((ns as { ldhName?: unknown })?.ldhName);
    if (ldh) out.push(ldh.toLowerCase());
  }
  return out;
}

/** Pure: one RDAP JSON object → a flat typed result. Robust to missing/wrong types. */
export function parseRdap(json: RdapResponse | null | undefined, kind: WhoisKind): WhoisResult {
  const result = emptyWhois(kind);
  if (!json || typeof json !== "object") return result;

  result.status = strArray(json.status); // common to both kinds

  if (kind === "domain") {
    const name = str(json.ldhName)?.toLowerCase();
    if (name) result.name = name;
    const handle = str(json.handle);
    if (handle) result.handle = handle;

    const registrar = entityName(findEntity(json.entities, "registrar"));
    if (registrar) result.registrar = registrar;

    const events = mapEvents(json.events);
    if (events.created) result.created = events.created;
    if (events.updated) result.updated = events.updated;
    if (events.expires) result.expires = events.expires;

    result.nameservers = mapNameservers(json.nameservers);
    result.ok = Boolean(result.name);
  } else {
    const name = str(json.name);
    if (name) result.name = name;
    const handle = str(json.handle);
    if (handle) result.handle = handle;
    const country = str(json.country);
    if (country) result.country = country;

    const start = str(json.startAddress);
    const end = str(json.endAddress);
    if (start && end) result.range = `${start} - ${end}`;
    else if (start) result.range = start;

    const type = str(json.type);
    if (type) result.type = type;

    const registrant = entityName(findEntity(json.entities, "registrant") ?? findEntity(json.entities, "abuse"));
    if (registrant) result.registrant = registrant;

    result.ok = Boolean(result.name || result.handle || result.range);
  }

  return result;
}
