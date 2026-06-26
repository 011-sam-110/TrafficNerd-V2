import { Camera, CameraArray, Source } from "@/lib/types";

export const CALTRANS_SOURCE: Source = {
  id: "caltrans",
  name: "Caltrans CCTV",
  license: "Caltrans Terms of Use",
  attribution: "Live traffic data © Caltrans (California DOT)",
  refreshSeconds: 60,
  needsKey: false,
};

const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export interface CaltransRecord {
  cctv: {
    index: string;
    location: {
      locationName?: string; nearbyPlace?: string;
      longitude?: string; latitude?: string; direction?: string; route?: string;
    };
    inService: string;
    imageData: {
      streamingVideoURL?: string;
      static?: { currentImageURL?: string; currentImageUpdateFrequency?: string };
    };
  };
}

export function normalizeCaltrans(records: CaltransRecord[], district: number): Camera[] {
  const cams: Camera[] = [];
  for (const r of records) {
    const c = r.cctv;
    const lat = Number(c.location?.latitude);
    const lon = Number(c.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const imageUrl = c.imageData?.static?.currentImageURL?.trim() || undefined;
    const streamUrl = c.imageData?.streamingVideoURL?.trim() || undefined;
    if (!imageUrl && !streamUrl) continue;
    const freqMin = Number(c.imageData?.static?.currentImageUpdateFrequency);
    const refreshSeconds = Number.isFinite(freqMin) && freqMin > 0 ? Math.max(30, freqMin * 60) : 60;
    cams.push({
      id: `caltrans:d${district}-${c.index}`,
      source: "caltrans",
      country: "US",
      region: "California",
      name: c.location?.locationName?.trim() || c.location?.nearbyPlace?.trim() || `Caltrans D${district} #${c.index}`,
      lat, lon,
      road: c.location?.route?.trim() || undefined,
      direction: c.location?.direction?.trim() || undefined,
      imageUrl,
      streamUrl,
      mediaType: streamUrl ? "both" : "jpeg",
      refreshSeconds,
      license: CALTRANS_SOURCE.license,
      attribution: CALTRANS_SOURCE.attribution,
      available: c.inService === "true",
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const results = await Promise.allSettled(
    DISTRICTS.map(async (d) => {
      const res = await fetch(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${d}.json`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Caltrans D${d}: ${res.status}`);
      const json = (await res.json()) as { data?: CaltransRecord[] };
      return normalizeCaltrans(json.data ?? [], d);
    }),
  );
  const cams = results
    .filter((r): r is PromiseFulfilledResult<Camera[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
  return CameraArray.parse(cams);
}
