import { z } from "zod";

export const CameraSchema = z.object({
  id: z.string(),                       // `${source}:${nativeId}`
  source: z.string(),
  country: z.string().length(2),        // ISO-3166 alpha-2
  region: z.string().optional(),
  name: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  road: z.string().optional(),
  direction: z.string().optional(),
  imageUrl: z.string().url().optional(),
  streamUrl: z.string().url().optional(),
  mediaType: z.enum(["jpeg", "video", "both"]),
  refreshSeconds: z.number().positive(),
  license: z.string().min(1),
  attribution: z.string().min(1),
  available: z.boolean(),
  lastSampledAt: z.string().optional(),
});

export type Camera = z.infer<typeof CameraSchema>;
export const CameraArray = z.array(CameraSchema);

// Windy webcams are a DISTINCT layer from road CCTV (different upstream, keyed,
// short-lived tokened image URLs) so they get their own normalized shape rather
// than reusing Camera — keeping the camera registry + counts uncontaminated.
export const WebcamSchema = z.object({
  id: z.string(),                       // `windy:${webcamId}`
  source: z.literal("windy"),
  title: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  country: z.string().optional(),       // ISO-3166 alpha-2 (location.country_code)
  region: z.string().optional(),
  city: z.string().optional(),
  categories: z.array(z.string()).optional(),
  // Token-bearing, short-lived (free tier ~10 min) — never cached long-term.
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  detailUrl: z.string().url(),          // the webcam's Windy page (attribution link)
  providerUrl: z.string().url().optional(),
  status: z.string(),
  available: z.boolean(),               // status === "active"
  lastUpdatedOn: z.string().optional(),
  license: z.string().min(1),
  attribution: z.string().min(1),
});

export type Webcam = z.infer<typeof WebcamSchema>;
export const WebcamArray = z.array(WebcamSchema);

export type Source = {
  id: string;
  name: string;
  license: string;
  attribution: string;
  refreshSeconds: number;
  needsKey: boolean;
};
