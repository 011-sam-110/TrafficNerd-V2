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

export type Source = {
  id: string;
  name: string;
  license: string;
  attribution: string;
  refreshSeconds: number;
  needsKey: boolean;
};
