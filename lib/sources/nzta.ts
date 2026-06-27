import { Camera, CameraArray, Source } from "@/lib/types";

// NZTA / Waka Kotahi — New Zealand Transport Agency state-highway cameras (~320,
// motorway + rural, nationwide). Keyless. `GET /service/traffic/rest/4/cameras/all`
// returns `{ response: { camera: [...] } }` (XML by default — we MUST send
// `Accept: application/json`). THE TRAP: each camera carries BOTH its own
// `latitude`/`longitude` AND a nested `journey` with start/end coordinates — the
// journey coords describe the whole route, NOT the camera, so we read the camera
// node's own lat/lon. Snapshot JPEGs are https://trafficnz.info + `imageUrl`
// (`/camera/{id}.jpg`); they load with no referer/cookie via the media proxy.

const ORIGIN = "https://trafficnz.info";

export const NZTA_SOURCE: Source = {
  id: "nzta",
  name: "NZTA / Waka Kotahi (New Zealand state highways)",
  license: "NZ Transport Agency Waka Kotahi — Open Data Terms of Use",
  attribution: "Live traffic-camera data © NZ Transport Agency Waka Kotahi (NZTA)",
  refreshSeconds: 120, // state-highway snapshots refresh every couple of minutes
  needsKey: false,
};

export interface NztaCamera {
  id?: number | string;
  imageUrl?: string; // relative, e.g. "/camera/714.jpg"
  // The camera node's OWN coordinates — these are the ones we use.
  latitude?: number | string;
  longitude?: number | string;
  name?: string;
  description?: string;
  direction?: string;
  highway?: string;
  region?: { id?: number; name?: string } | null;
  offline?: boolean;
  underMaintenance?: boolean;
  // `journey` carries route start/end coords — deliberately NOT read.
  journey?: unknown;
}

export function normalizeNzta(payload: { response?: { camera?: NztaCamera[] } }): Camera[] {
  const cams: Camera[] = [];
  for (const c of payload.response?.camera ?? []) {
    // Use the camera node's OWN lat/lon — NOT the nested journey start/end coords.
    const lat = Number(c.latitude);
    const lon = Number(c.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (lat === 0 && lon === 0) continue; // null-island guard
    const nativeId = (c.id ?? "").toString().trim();
    if (!nativeId) continue;
    const rel = c.imageUrl?.trim();
    if (!rel) continue;
    const imageUrl = /^https?:\/\//.test(rel)
      ? rel
      : `${ORIGIN}${rel.startsWith("/") ? "" : "/"}${rel}`;
    cams.push({
      id: `nzta:${nativeId}`,
      source: "nzta",
      country: "NZ",
      region: c.region?.name?.trim() || "New Zealand",
      name: c.name?.trim() || c.description?.trim() || `NZTA camera ${nativeId}`,
      lat,
      lon,
      road: c.highway?.trim() || undefined,
      direction: c.direction?.trim() || undefined,
      imageUrl,
      mediaType: "jpeg",
      refreshSeconds: NZTA_SOURCE.refreshSeconds,
      license: NZTA_SOURCE.license,
      attribution: NZTA_SOURCE.attribution,
      // Offline / under-maintenance cams are kept but flagged not-live.
      available: c.offline !== true && c.underMaintenance !== true,
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch(`${ORIGIN}/service/traffic/rest/4/cameras/all`, {
    headers: {
      // Mandatory — without it the service returns XML, not JSON.
      Accept: "application/json",
      "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NZTA cameras: ${res.status}`);
  const json = (await res.json()) as { response?: { camera?: NztaCamera[] } };
  return CameraArray.parse(normalizeNzta(json));
}
