// Env-driven backend selection for /api/geolocate. Server-only — none of this is
// ever serialised to the client (keys stay on the server, like /api/webcam-image).
//
// Default backend = "geoclip" (the picarta-grade GeoCLIP geo-embedding model, run
// by a local Python sidecar — scripts/geolocate_service.py). The route PREFERS
// this for accuracy but gracefully falls back to "llm" (the always-on, keyless
// vision path through Sampo's freellmapi.co gateway) whenever GeoCLIP's sidecar
// isn't running — so /locate still works out of the box, just at lower accuracy.
// Force a single backend with GEOLOCATE_BACKEND=geoclip|llm.

import type { GeolocateMethod } from "./types";

export type Backend = "llm" | "geoclip";

/** The PREFERRED backend. Defaults to GeoCLIP (best accuracy); the route falls
 *  back to the other one if the preferred is dormant. */
export function selectedBackend(): Backend {
  return (process.env.GEOLOCATE_BACKEND ?? "").toLowerCase() === "llm" ? "llm" : "geoclip";
}

/** Preferred backend first, then the fallback — the route tries them in order. */
export function backendOrder(): Backend[] {
  return selectedBackend() === "llm" ? ["llm", "geoclip"] : ["geoclip", "llm"];
}

export function methodLabel(b: Backend): GeolocateMethod {
  return b === "geoclip" ? "geo-model" : "vision-ai";
}

export interface FreellmConfig {
  baseUrl: string;
  key: string;
  model: string;
}

/** Read the freellmapi.co gateway config, or null if it isn't configured. */
export function freellmConfig(): FreellmConfig | null {
  const baseUrl = (process.env.FREELLMAPI_BASE_URL ?? "").trim();
  const key = (process.env.FREELLMAPI_KEY ?? "").trim();
  if (!baseUrl || !key) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    key,
    // The gateway routes "auto" to whatever vision model is available.
    model: (process.env.FREELLMAPI_VISION_MODEL ?? "auto").trim() || "auto",
  };
}

export interface GeoclipConfig {
  url: string;
}

/** Read the GeoCLIP sidecar URL, or null if it isn't configured. */
export function geoclipConfig(): GeoclipConfig | null {
  const url = (process.env.GEOLOCATE_GEOCLIP_URL ?? "").trim();
  if (!url) return null;
  return { url: url.replace(/\/+$/, "") };
}

/** Upload ceiling (bytes). Vision gateways choke well before this; keeps a hostile
 *  client from streaming a huge body into a Route Handler. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** A typed signal that a backend is dormant (missing config / unreachable sidecar).
 *  The route turns this into a clean JSON message, NOT a 5xx stack trace. */
export class BackendNotConfiguredError extends Error {}
