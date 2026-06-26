// Each rule is host + required path prefix (+ optional suffix). Adding a source
// = adding a rule. SCDOT snapshots live at the host root as `/<id>.png`, so that
// rule pins the suffix instead of a deep prefix to stay tight.
const RULES: { host: string; prefix: string; suffix?: string }[] = [
  { host: "s3-eu-west-1.amazonaws.com", prefix: "/jamcams.tfl.gov.uk/" },
  { host: "cwwp2.dot.ca.gov", prefix: "/data/" },
  { host: "scdotsnap.us-east-1.skyvdn.com", prefix: "/", suffix: ".png" },
];

export function isAllowed(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return RULES.some(
    (r) =>
      url.hostname === r.host &&
      url.pathname.startsWith(r.prefix) &&
      (!r.suffix || url.pathname.endsWith(r.suffix)),
  );
}
