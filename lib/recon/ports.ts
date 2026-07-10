// Passive port intelligence via Shodan InternetDB (`internetdb.shodan.io/<ip>`).
// Keyless, no auth. This is a PRE-INDEXED lookup — Shodan's own scan data — never
// an active scan we run. This PURE mapper turns one InternetDB JSON response into a
// typed result. No fetch, no React → fast unit tests.

export interface InternetDbResponse {
  cpes?: string[];
  hostnames?: string[];
  ip?: string;
  ports?: number[];
  tags?: string[];
  vulns?: string[];
}

export interface PortsResult {
  ok: boolean;
  ip: string;
  ports: number[];
  cpes: string[];
  hostnames: string[];
  vulns: string[];
}

/** Well-known port → short service label (for nicer display; "" when unknown). */
const PORT_SERVICE: Record<number, string> = {
  22: "ssh",
  25: "smtp",
  53: "dns",
  80: "http",
  110: "pop3",
  143: "imap",
  443: "https",
  3306: "mysql",
  3389: "rdp",
  5432: "postgres",
  6379: "redis",
  8080: "http-alt",
  8443: "https-alt",
  27017: "mongodb",
};

/** Pure: map a port number to a common service name, or "" if not well-known. */
export function portService(port: number): string {
  return PORT_SERVICE[port] ?? "";
}

/** Pure: keep only strings from an array (drops null/empty/non-string), else []. */
function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/** Pure: one InternetDB JSON response → typed ports result. Robust to missing/null arrays. */
export function parseInternetDb(json: InternetDbResponse | null | undefined): PortsResult {
  const ports = Array.isArray(json?.ports)
    ? [...new Set(json!.ports.filter((p): p is number => typeof p === "number"))].sort((a, b) => a - b)
    : [];
  const cpes = strings(json?.cpes);
  const hostnames = strings(json?.hostnames);
  const vulns = strings(json?.vulns);
  const ip = typeof json?.ip === "string" ? json.ip.trim() : "";
  return {
    ok: ports.length > 0 || cpes.length > 0 || vulns.length > 0,
    ip,
    ports,
    cpes,
    hostnames,
    vulns,
  };
}
