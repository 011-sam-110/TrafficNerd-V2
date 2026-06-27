// Photo-geolocation types — shared by the API route, the backends, and the UI.
//
// A keyless "picarta.ai" equivalent: given a photo, estimate WHERE it was taken.
// We normalise every backend (vision-LLM or the GeoCLIP geo-embedding sidecar)
// down to the same ranked-candidate shape so the route and UI never branch on it.

/** A backend prediction before coordinate/place resolution. lat/lon may be null
 *  (e.g. the LLM named a place but gave no coords → the route geocodes it). */
export interface RawCandidate {
  /** Free-text place label, e.g. "Shibuya Crossing, Tokyo". May be "" for a
   *  pure geo-model hit that only knows coordinates (the route reverse-geocodes). */
  place: string;
  country?: string;
  lat: number | null;
  lon: number | null;
  /** 0..1 model self-estimate. Honest-but-soft — see the UI accuracy note. */
  confidence: number;
  /** Optional human-readable rationale (vision LLM only). */
  reasoning?: string;
}

/** A candidate after the route has resolved real coordinates — what the UI plots. */
export interface ResolvedCandidate {
  place: string;
  country?: string;
  lat: number;
  lon: number;
  confidence: number;
  reasoning?: string;
}

/** Honest method label shown to the user. */
export type GeolocateMethod = "vision-ai" | "geo-model";

export interface GeolocateResponse {
  candidates: ResolvedCandidate[];
  method: GeolocateMethod;
  /** Present when a backend is dormant/unreachable or the input was rejected.
   *  The route NEVER throws an unhandled 5xx — it returns this instead. */
  error?: string;
  /** Always-on honesty caption (e.g. "estimated location, not a measurement"). */
  note?: string;
}
