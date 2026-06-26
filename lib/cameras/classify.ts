// Classify a camera by what it streams. Two icon shapes:
//   • "video" — a live HLS feed (mediaType "video" or "both")
//   • "still" — a refreshing JPEG snapshot (mediaType "jpeg")
// The icon's COLOUR encodes the region (see lib/icons/svg.ts), so the two
// dimensions together (shape = feed, colour = region) give a maximal camera
// taxonomy. Pure + unit-tested.

export type CameraFeed = "video" | "still";

/** Feed type from the camera's mediaType. */
export function classifyCameraFeed(mediaType: "jpeg" | "video" | "both"): CameraFeed {
  return mediaType === "jpeg" ? "still" : "video";
}
