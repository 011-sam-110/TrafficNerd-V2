import { Camera, CameraArray, Source } from "@/lib/types";

// Oregon TripCheck (ODOT) — the Oregon Department of Transportation's statewide
// CCTV inventory (~1,127 cameras, highway + rural). Keyless. The endpoint is an
// ESRI FeatureSet served as a `.js` file (pure JSON body, no JSONP wrapper).
//
// THE TRAP: the FeatureSet is labelled `spatialReference: { wkid: 3857 }` and
// every feature carries a `geometry: { x, y }` in web-mercator METRES. We IGNORE
// that geometry entirely. Each feature's `attributes.latitude`/`longitude` are
// plain WGS84 degrees — those are the real coordinates and the only ones we use.
//
// Snapshots live at https://tripcheck.com/RoadCams/cams/<filename>; the
// `filename` attribute already carries its own extension (.jpg or .JPG) and may
// contain spaces or `@`, so we encodeURI() it (preserves /,@,: — %20-encodes
// spaces). Images load with no referer/cookie.

export const TRIPCHECK_SOURCE: Source = {
  id: "tripcheck",
  name: "Oregon TripCheck (ODOT)",
  license: "ODOT TripCheck Terms of Use",
  attribution: "Live traffic-camera data © Oregon DOT (ODOT) / TripCheck.com",
  refreshSeconds: 60, // ODOT highway snapshots refresh roughly every minute
  needsKey: false,
};

export interface TripCheckFeature {
  attributes?: {
    cameraId?: number | string;
    publishedImageId?: number | string;
    filename?: string;
    iconType?: number;
    latitude?: number | string; // plain WGS84 — use this
    longitude?: number | string; // plain WGS84 — use this
    route?: string;
    title?: string;
    videoId?: number | string;
  } | null;
  // `geometry` is web-mercator metres (wkid:3857) — deliberately NOT read.
  geometry?: { x?: number; y?: number } | null;
}

export function normalizeTripCheck(featureset: { features?: TripCheckFeature[] }): Camera[] {
  const cams: Camera[] = [];
  for (const f of featureset.features ?? []) {
    const a = f.attributes ?? {};
    // Use the named WGS84 attrs, NOT geometry.x/y (those are 3857 metres).
    const lat = Number(a.latitude);
    const lon = Number(a.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (lat === 0 && lon === 0) continue; // null-island guard
    const filename = a.filename?.trim();
    if (!filename) continue;
    const nativeId = (a.cameraId ?? a.publishedImageId ?? "").toString().trim();
    if (!nativeId) continue;
    const road = a.route?.trim() || undefined;
    cams.push({
      id: `tripcheck:${nativeId}`,
      source: "tripcheck",
      country: "US",
      region: "Oregon",
      name: a.title?.trim() || (road ? `${road} ${nativeId}` : `TripCheck ${nativeId}`),
      lat,
      lon,
      road,
      // filename may contain spaces/@ → encodeURI keeps /,@,: but %20-encodes spaces.
      imageUrl: `https://tripcheck.com/RoadCams/cams/${encodeURI(filename)}`,
      mediaType: "jpeg",
      refreshSeconds: TRIPCHECK_SOURCE.refreshSeconds,
      license: TRIPCHECK_SOURCE.license,
      attribution: TRIPCHECK_SOURCE.attribution,
      available: true, // the inventory lists only published, active cameras
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch("https://tripcheck.com/Scripts/map/data/cctvinventory.js", {
    headers: {
      // Served as application/javascript but the body is pure JSON; res.json()
      // ignores content-type and parses it regardless.
      Accept: "application/json, text/javascript, */*",
      "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`TripCheck inventory: ${res.status}`);
  const json = (await res.json()) as { features?: TripCheckFeature[] };
  return CameraArray.parse(normalizeTripCheck(json));
}
