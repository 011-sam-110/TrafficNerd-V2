import { Camera, CameraArray, Source } from "@/lib/types";

// Estonia — Tark Tee (Transpordiamet / Estonian Transport Administration) national
// road-weather cameras (~180, highway + rural). Keyless. We query the ArcGIS
// `tram/road_cameras` layer (the root layer is frozen/stale) with `outSR=4326`, so
// geometry comes back as plain WGS84: `geometry.x`=longitude, `geometry.y`=latitude.
// THE GOTCHA: the snapshot `image_path` embeds a fresh timestamp on every update
// (`94/94_202606270441.jpg`), so we rebuild `imageUrl` on each registry refresh
// rather than caching a path that will 404 — image host is
// https://tarktee.transpordiamet.ee/images/{image_path}.

const QUERY_URL =
  "https://tarktee.transpordiamet.ee/tarktee/rest/services/tram/road_cameras/MapServer/0/query?where=1=1&outFields=*&outSR=4326&f=json";
const IMAGE_ORIGIN = "https://tarktee.transpordiamet.ee/images";

export const ESTONIA_SOURCE: Source = {
  id: "estonia",
  name: "Tark Tee (Estonian Transport Administration)",
  license: "Transpordiamet (Tark Tee) — Open Data Terms of Use",
  attribution:
    "Live road-camera data © Transpordiamet (Estonian Transport Administration) / Tark Tee",
  refreshSeconds: 300, // road-weather cams update slowly
  needsKey: false,
};

export interface EstoniaFeature {
  attributes?: {
    objectid?: number | string;
    site_name?: string;
    weather_station_id?: number | string;
    image_path?: string | null; // timestamped, changes each update
    image_time?: number;
  } | null;
  geometry?: { x?: number; y?: number } | null; // outSR=4326 → x=lon, y=lat
}

export function normalizeEstonia(featureset: { features?: EstoniaFeature[] }): Camera[] {
  const cams: Camera[] = [];
  for (const f of featureset.features ?? []) {
    const a = f.attributes ?? {};
    // outSR=4326 → geometry is plain WGS84 degrees: x = longitude, y = latitude.
    const lon = Number(f.geometry?.x);
    const lat = Number(f.geometry?.y);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (lat === 0 && lon === 0) continue; // null-island guard
    const path = a.image_path?.trim();
    if (!path) continue;
    const nativeId = (a.objectid ?? a.weather_station_id ?? "").toString().trim();
    if (!nativeId) continue;
    cams.push({
      id: `estonia:${nativeId}`,
      source: "estonia",
      country: "EE",
      region: "Estonia",
      name: a.site_name?.trim() || `Tark Tee ${nativeId}`,
      lat,
      lon,
      // image_path is timestamped → rebuilt every refresh (never cache the path).
      imageUrl: `${IMAGE_ORIGIN}/${path.replace(/^\/+/, "")}`,
      mediaType: "jpeg",
      refreshSeconds: ESTONIA_SOURCE.refreshSeconds,
      license: ESTONIA_SOURCE.license,
      attribution: ESTONIA_SOURCE.attribution,
      available: true,
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch(QUERY_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Tark Tee cameras: ${res.status}`);
  const json = (await res.json()) as { features?: EstoniaFeature[] };
  return CameraArray.parse(normalizeEstonia(json));
}
