// Streaming hosts are separate from the still-image allowlist: each rule also
// carries the Referer to inject (Caltrans' wzmedia is hotlink-protected).
type HlsRule = { match: (host: string) => boolean; prefix: string; referer: string };

const RULES: HlsRule[] = [
  { match: (h) => h === "wzmedia.dot.ca.gov", prefix: "/", referer: "https://cwwp2.dot.ca.gov/" },
  { match: (h) => h.endsWith(".us-east-1.skyvdn.com"), prefix: "/rtplive/", referer: "https://www.511sc.org/" },
];

export function isHlsAllowed(url: URL): { ok: boolean; referer?: string } {
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false };
  for (const r of RULES) {
    if (r.match(url.hostname) && url.pathname.startsWith(r.prefix)) {
      return { ok: true, referer: r.referer };
    }
  }
  return { ok: false };
}
