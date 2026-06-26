// Each rule is host + required path prefix. Adding a source = adding a rule.
const RULES: { host: string; prefix: string }[] = [
  { host: "s3-eu-west-1.amazonaws.com", prefix: "/jamcams.tfl.gov.uk/" },
  { host: "cwwp2.dot.ca.gov", prefix: "/data/" },
  { host: "scdotsnap.us-east-1.skyvdn.com", prefix: "/thumbs/" },
];

export function isAllowed(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return RULES.some((r) => url.hostname === r.host && url.pathname.startsWith(r.prefix));
}
