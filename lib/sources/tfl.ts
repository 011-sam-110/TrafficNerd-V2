import { Camera, CameraArray, Source } from "@/lib/types";

export const TFL_SOURCE: Source = {
  id: "tfl",
  name: "TfL JamCams",
  license: "OGL",
  attribution: "Powered by TfL Open Data",
  refreshSeconds: 300,
  needsKey: false,
};

interface TflProp {
  key: string;
  value: string;
}

export interface TflPlace {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  additionalProperties: TflProp[];
}

export function normalizeTfl(places: TflPlace[]): Camera[] {
  return places.map((p): Camera => {
    const props: Record<string, string> = {};
    for (const a of p.additionalProperties) props[a.key] = a.value;
    const hasVideo = Boolean(props.videoUrl);
    return {
      id: `tfl:${p.id}`,
      source: "tfl",
      country: "GB",
      region: "London",
      name: p.commonName,
      lat: p.lat,
      lon: p.lon,
      imageUrl: props.imageUrl,
      streamUrl: props.videoUrl,
      mediaType: hasVideo ? "both" : "jpeg",
      refreshSeconds: TFL_SOURCE.refreshSeconds,
      license: TFL_SOURCE.license,
      attribution: TFL_SOURCE.attribution,
      available: props.available === "true",
    };
  });
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch("https://api.tfl.gov.uk/Place/Type/JamCam", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TfL JamCam fetch failed: ${res.status}`);
  const places = (await res.json()) as TflPlace[];
  return CameraArray.parse(normalizeTfl(places));
}
