import { Camera, CameraArray, Source } from "@/lib/types";

// Fintraffic Digitraffic — Finland's national weather-camera network. Keyless,
// well-documented, reliable (the PRD's "cleanest source"). One quirk: the API
// REQUIRES `Accept-Encoding: gzip` or it 406s. Each station has several camera
// "presets" (views); we surface one pin per station using its first active
// preset's image at https://weathercam.digitraffic.fi/<presetId>.jpg.

export const DIGITRAFFIC_SOURCE: Source = {
  id: "digitraffic",
  name: "Fintraffic Digitraffic (Finland)",
  license: "CC BY 4.0 (Fintraffic)",
  attribution: "Live weather-camera data © Fintraffic / Digitraffic",
  refreshSeconds: 300, // weather cams update slowly
  needsKey: false,
};

export interface DigiStation {
  id?: string;
  geometry?: { coordinates?: [number, number, number?] } | null;
  properties?: {
    id?: string;
    name?: string;
    collectionStatus?: string; // "GATHERING" when active
    presets?: { id?: string; inCollection?: boolean }[];
  };
}

export function normalizeDigitraffic(geojson: { features?: DigiStation[] }): Camera[] {
  const cams: Camera[] = [];
  for (const f of geojson.features ?? []) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const preset = (p.presets ?? []).find((x) => x.inCollection && x.id) ?? (p.presets ?? [])[0];
    if (!preset?.id) continue;
    const stationId = (f.id ?? p.id ?? "").toString().trim();
    if (!stationId) continue;
    cams.push({
      id: `digitraffic:${stationId}`,
      source: "digitraffic",
      country: "FI",
      region: "Finland",
      name: p.name?.trim() || `Digitraffic ${stationId}`,
      lat,
      lon,
      imageUrl: `https://weathercam.digitraffic.fi/${preset.id}.jpg`,
      mediaType: "jpeg",
      refreshSeconds: DIGITRAFFIC_SOURCE.refreshSeconds,
      license: DIGITRAFFIC_SOURCE.license,
      attribution: DIGITRAFFIC_SOURCE.attribution,
      available: p.collectionStatus === "GATHERING",
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch("https://tie.digitraffic.fi/api/weathercam/v1/stations", {
    headers: {
      // Mandatory — the API 406s without it (undici still auto-decompresses).
      "Accept-Encoding": "gzip",
      "Digitraffic-User": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Digitraffic stations: ${res.status}`);
  const json = (await res.json()) as { features?: DigiStation[] };
  return CameraArray.parse(normalizeDigitraffic(json));
}
