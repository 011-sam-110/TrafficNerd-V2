// Pure: resolve a traffic-camera attribution string to its operator's home page,
// so the camera dossier can credit the source with a CLICKABLE link (the product
// rule: every selector shows its data source as a real link). Cameras carry no raw
// upstream URL by design (snapshots are proxied), so the operator home page is the
// honest, stable target. Unknown operators return null → plain-text credit, never a
// fabricated link. Matched case-insensitively on a distinctive substring of the
// attribution, so a small table covers every camera network the app ingests.
//
// No DOM, no fetch — fully unit-testable.

interface CameraProvider {
  /** Case-insensitive substring that identifies the operator in the attribution. */
  match: string;
  /** Short operator name shown as the link text. */
  label: string;
  /** Operator home / open-data page. */
  url: string;
}

const CAMERA_PROVIDERS: CameraProvider[] = [
  { match: "TfL", label: "TfL Open Data", url: "https://tfl.gov.uk/info-for/open-data-users/" },
  { match: "Caltrans", label: "Caltrans", url: "https://dot.ca.gov/" },
  { match: "SCDOT", label: "SCDOT 511", url: "https://www.511sc.org/" },
  { match: "Digitraffic", label: "Fintraffic Digitraffic", url: "https://www.digitraffic.fi/en/" },
  { match: "Fintraffic", label: "Fintraffic Digitraffic", url: "https://www.digitraffic.fi/en/" },
  { match: "DriveBC", label: "DriveBC", url: "https://www.drivebc.ca/" },
  { match: "British Columbia", label: "DriveBC", url: "https://www.drivebc.ca/" },
  { match: "Waka Kotahi", label: "NZTA Waka Kotahi", url: "https://www.nzta.govt.nz/" },
  { match: "NZTA", label: "NZTA Waka Kotahi", url: "https://www.nzta.govt.nz/" },
  { match: "Vegagerðin", label: "Vegagerðin (Iceland)", url: "https://www.vegagerdin.is/" },
  { match: "IRCA", label: "Vegagerðin (Iceland)", url: "https://www.vegagerdin.is/" },
  { match: "Transpordiamet", label: "Transpordiamet (Estonia)", url: "https://www.transpordiamet.ee/" },
  { match: "Tark Tee", label: "Tark Tee (Estonia)", url: "https://tarktee.transpordiamet.ee/" },
  { match: "Traffic Scotland", label: "Traffic Scotland", url: "https://trafficscotland.org/" },
  { match: "Transport Scotland", label: "Traffic Scotland", url: "https://trafficscotland.org/" },
  { match: "TripCheck", label: "ODOT TripCheck", url: "https://tripcheck.com/" },
  { match: "Oregon DOT", label: "ODOT TripCheck", url: "https://tripcheck.com/" },
  { match: "511", label: "511 traveler information", url: "https://www.fhwa.dot.gov/trafficinfo/511.htm" },
  { match: "Windy", label: "Windy.com", url: "https://www.windy.com/webcams" },
];

export interface CameraSource {
  label: string;
  url: string;
}

/** Resolve an attribution string to the operator's clickable home page, or null. */
export function cameraProviderLink(attribution: string | undefined | null): CameraSource | null {
  if (!attribution) return null;
  const hay = attribution.toLowerCase();
  for (const p of CAMERA_PROVIDERS) {
    if (hay.includes(p.match.toLowerCase())) return { label: p.label, url: p.url };
  }
  return null;
}
