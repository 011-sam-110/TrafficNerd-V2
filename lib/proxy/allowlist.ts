// Each rule is host + required path prefix (+ optional suffix). Adding a source
// = adding a rule. SCDOT snapshots live at the host root as `/<id>.png`, so that
// rule pins the suffix instead of a deep prefix to stay tight.
const RULES: { host: string; prefix: string; suffix?: string }[] = [
  { host: "s3-eu-west-1.amazonaws.com", prefix: "/jamcams.tfl.gov.uk/" },
  { host: "cwwp2.dot.ca.gov", prefix: "/data/" },
  { host: "scdotsnap.us-east-1.skyvdn.com", prefix: "/", suffix: ".png" },
  { host: "weathercam.digitraffic.fi", prefix: "/", suffix: ".jpg" },
  // Castle Rock "511" snapshots — one host per system, all serving /map/Cctv/{id}.
  { host: "fl511.com", prefix: "/map/Cctv/" },
  { host: "511ga.org", prefix: "/map/Cctv/" },
  { host: "511ny.org", prefix: "/map/Cctv/" },
  { host: "511.idaho.gov", prefix: "/map/Cctv/" },
  { host: "newengland511.org", prefix: "/map/Cctv/" },
  { host: "511on.ca", prefix: "/map/Cctv/" },
  { host: "511.alberta.ca", prefix: "/map/Cctv/" },
  { host: "511.novascotia.ca", prefix: "/map/Cctv/" },
  { host: "511.gnb.ca", prefix: "/map/Cctv/" },
  // Oregon TripCheck — filenames are mixed-case .jpg/.JPG, so no suffix pin.
  { host: "tripcheck.com", prefix: "/RoadCams/cams/" },
  // DriveBC (British Columbia).
  { host: "www.drivebc.ca", prefix: "/images/", suffix: ".jpg" },
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
