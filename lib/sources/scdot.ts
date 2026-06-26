import { Camera, CameraArray, Source } from "@/lib/types";

export const SCDOT_SOURCE: Source = {
  id: "scdot",
  name: "SCDOT 511 (South Carolina DOT)",
  license: "SCDOT 511 Terms of Use",
  attribution: "Live traffic data © SCDOT / 511sc.org",
  refreshSeconds: 60,
  needsKey: false,
};

export interface ScFeature {
  geometry?: { coordinates?: [number, number] } | null;
  properties?: {
    id?: string; name?: string; description?: string; route?: string; direction?: string;
    https_url?: string; ios_url?: string; image_url?: string;
    active?: boolean; problem_stream?: boolean;
  };
}

export function normalizeScdot(geojson: { features?: ScFeature[] }): Camera[] {
  const cams: Camera[] = [];
  for (const f of geojson.features ?? []) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const imageUrl = p.image_url?.trim() || undefined;
    const streamUrl = p.https_url?.trim() || p.ios_url?.trim() || undefined;
    if (!imageUrl && !streamUrl) continue;
    const nativeId = (p.name ?? p.id ?? "").toString().trim();
    if (!nativeId) continue;
    cams.push({
      id: `scdot:${nativeId}`,
      source: "scdot",
      country: "US",
      region: "South Carolina",
      name: p.description?.trim() || p.name?.trim() || `SCDOT ${nativeId}`,
      lat, lon,
      road: p.route?.trim() || undefined,
      direction: p.direction?.trim() || undefined,
      imageUrl,
      streamUrl,
      mediaType: streamUrl ? "both" : "jpeg",
      refreshSeconds: SCDOT_SOURCE.refreshSeconds,
      license: SCDOT_SOURCE.license,
      attribution: SCDOT_SOURCE.attribution,
      available: p.active === true && p.problem_stream !== true,
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch("https://sc.cdn.iteris-atis.com/geojson/icons/metadata/icons.cameras.geojson", {
    headers: { Accept: "application/json", Referer: "https://www.511sc.org/" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`SCDOT GeoJSON: ${res.status}`);
  const json = (await res.json()) as { features?: ScFeature[] };
  return CameraArray.parse(normalizeScdot(json));
}
