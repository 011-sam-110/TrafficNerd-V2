// Single source of truth for every type icon on the map.
//
// Each icon is a hand-authored 24×24 SVG pictogram drawn in `currentColor`, so
// it can be (a) rendered inline in the legend/overlay at any CSS colour and
// (b) rasterised to a tinted sprite texture for the 3D globe and to an SDF
// symbol for the MapLibre map. Keeping the art, palette and labels together
// means the globe, the map markers and the legend can never drift apart.
//
// Pure + isomorphic (no DOM / no three.js here) so it can be imported anywhere.

import type { SatCategory } from "@/lib/satellites/classify";
import type { PlaneCategory } from "@/lib/planes/classify";
import type { CameraFeed } from "@/lib/cameras/classify";

export type IconKey =
  | "sat-station" | "sat-starlink" | "sat-oneweb" | "sat-navigation" | "sat-weather"
  | "sat-eo" | "sat-science" | "sat-comms" | "sat-cubesat" | "sat-debris" | "sat-other"
  | "plane-airliner" | "plane-regional" | "plane-light" | "plane-helicopter" | "plane-ground"
  | "cam-still" | "cam-video";

// "Inner" dark used for cut-outs (lenses, panel cells) that should read against
// any tint — it stays constant when currentColor is replaced.
const INK = "#0b0f1a";

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${inner}</svg>`;

export const ICON_SVG: Record<IconKey, string> = {
  // --- Satellites ---------------------------------------------------------
  "sat-station": wrap(
    `<rect x="10.3" y="8.5" width="3.4" height="7" rx=".6"/><rect x="2" y="9.5" width="7" height="5" rx=".6"/><rect x="15" y="9.5" width="7" height="5" rx=".6"/><rect x="11.3" y="2.6" width="1.4" height="6"/><rect x="11.3" y="15.4" width="1.4" height="6"/>`,
  ),
  "sat-starlink": wrap(
    `<rect x="2.5" y="10" width="9" height="4" rx=".6"/><rect x="12.5" y="6.5" width="9" height="11" rx=".9"/><path d="M14.5 9h5M14.5 12h5M14.5 15h5" stroke="${INK}" stroke-width=".7"/>`,
  ),
  "sat-oneweb": wrap(
    `<rect x="9" y="8.8" width="6" height="6.4" rx=".9"/><rect x="2.4" y="10" width="5.6" height="4" rx=".5"/><rect x="16" y="10" width="5.6" height="4" rx=".5"/>`,
  ),
  "sat-navigation": wrap(
    `<rect x="9.6" y="2.6" width="4.8" height="4.6" rx=".6"/><rect x="4" y="3.4" width="4.6" height="3.2" rx=".4"/><rect x="15.4" y="3.4" width="4.6" height="3.2" rx=".4"/><path d="M12 7.4v3.6" stroke="currentColor" stroke-width="1.4"/><path d="M7.6 13.2a6 6 0 0 1 8.8 0" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.6 16.4a10 10 0 0 1 14.8 0" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
  ),
  "sat-weather": wrap(
    `<rect x="9.6" y="3" width="4.8" height="4.4" rx=".6"/><rect x="3.6" y="3.7" width="5" height="3" rx=".4"/><rect x="15.4" y="3.7" width="5" height="3" rx=".4"/><path d="M9.8 7.4 7.2 21h9.6L14.2 7.4z" opacity=".5"/><circle cx="12" cy="8.6" r="1.3"/>`,
  ),
  "sat-eo": wrap(
    `<rect x="9" y="2.8" width="6" height="5" rx=".6"/><rect x="2.8" y="3.7" width="5.4" height="3.2" rx=".4"/><rect x="15.8" y="3.7" width="5.4" height="3.2" rx=".4"/><rect x="10.6" y="7.8" width="2.8" height="2.6"/><circle cx="12" cy="15" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="15" r="1.2"/>`,
  ),
  "sat-science": wrap(
    `<rect x="7.4" y="5" width="9.2" height="13" rx="1.4"/><rect x="8.8" y="2.6" width="6.4" height="2.8" rx="1"/><rect x="3.4" y="9.5" width="4" height="4" rx=".5"/><rect x="16.6" y="9.5" width="4" height="4" rx=".5"/><circle cx="12" cy="7.2" r="1.7" fill="${INK}"/>`,
  ),
  "sat-comms": wrap(
    `<rect x="10" y="11" width="4" height="6.5" rx=".5"/><rect x="3" y="12" width="6" height="4" rx=".5"/><rect x="15" y="12" width="6" height="4" rx=".5"/><path d="M12 11.4 6.4 5.6a7.8 7.8 0 0 1 11.2 0L12 11.4z"/><circle cx="12" cy="7.8" r="1" fill="${INK}"/>`,
  ),
  "sat-cubesat": wrap(
    `<rect x="8.4" y="8.4" width="7.2" height="7.2" rx=".8"/><rect x="9.8" y="9.8" width="4.4" height="4.4" rx=".4" fill="${INK}"/><rect x="2.8" y="10.4" width="4.6" height="3.2" rx=".4"/><rect x="16.6" y="10.4" width="4.6" height="3.2" rx=".4"/>`,
  ),
  "sat-debris": wrap(
    `<path d="M7.5 3.6 13 5.2l3.6-1.1 2.3 4.8-2.8 3.1 1.2 5.2-5.6-1.2-4.4 2.4-1.1-5.7L3 6.6z" opacity=".92"/>`,
  ),
  "sat-other": wrap(
    `<rect x="9.5" y="8.5" width="5" height="7" rx=".6"/><rect x="3" y="9.5" width="5.5" height="5" rx=".5"/><rect x="15.5" y="9.5" width="5.5" height="5" rx=".5"/><path d="M12 8.5V4M10 4h4" stroke="currentColor" stroke-width="1.3" fill="none"/>`,
  ),

  // --- Planes (top view, nose pointing UP/north) --------------------------
  "plane-airliner": wrap(
    `<path d="M12 1.4c.85 0 1.45 1.25 1.55 3.3l.12 3.2 7.83 4.55v2.05l-7.83-2.3v4.45l2.45 1.6v1.75L12 22.6l-4.12-1.0v-1.75l2.45-1.6v-4.45l-7.83 2.3V12.45L10.33 7.9l.12-3.2C10.55 2.65 11.15 1.4 12 1.4z"/>`,
  ),
  "plane-regional": wrap(
    `<path d="M12 2.6c.72 0 1.22 1.05 1.32 2.8l.1 2.9 6.58 3.75v1.75l-6.58-1.9v3.7l2.05 1.45v1.55L12 21.3l-3.47-.7v-1.55l2.05-1.45v-3.7l-6.58 1.9V12.05L10.58 8.3l.1-2.9C10.78 3.65 11.28 2.6 12 2.6z"/>`,
  ),
  "plane-light": wrap(
    `<path d="M11 3.2h2v4.1l8 3v2l-8-1.6v6.1l3 1.9v1.4l-5-1-5 1v-1.4l3-1.9v-6.1l-8 1.6v-2l8-3z"/><rect x="8.6" y="1.8" width="6.8" height="1.4" rx=".7"/>`,
  ),
  "plane-helicopter": wrap(
    `<rect x="2" y="11.2" width="20" height="1.5" rx=".75"/><rect x="11.25" y="2" width="1.5" height="20" rx=".75"/><ellipse cx="12" cy="12" rx="2.6" ry="3.7"/><rect x="11.4" y="14.8" width="1.2" height="6.4"/><rect x="9.4" y="20.4" width="5.2" height="1.4" rx=".7"/>`,
  ),
  "plane-ground": wrap(
    `<path d="M12 1.8c.78 0 1.32 1.1 1.42 3l.1 2.9 7.18 4.15v1.85l-7.18-2.1v4l2.2 1.45v1.55L12 18.6l-3.72-.95v-1.55l2.2-1.45v-4l-7.18 2.1V11.85L10.48 7.7l.1-2.9C10.68 2.9 11.22 1.8 12 1.8z"/><rect x="2.5" y="20.6" width="19" height="1.6" rx=".8" opacity=".75"/>`,
  ),

  // --- Cameras ------------------------------------------------------------
  "cam-still": wrap(
    `<path d="M2.6 7.7 16 4.4c1-.25 2.02.37 2.3 1.4l.5 1.95c.27 1.02-.35 2.05-1.37 2.32L3.6 13.6 2.6 7.7z"/><circle cx="6.1" cy="9.1" r="1.15" fill="${INK}"/><rect x="11" y="13" width="2" height="5.1"/><rect x="6.8" y="18" width="10.4" height="1.8" rx=".9"/>`,
  ),
  "cam-video": wrap(
    `<path d="M1.8 8.1 12.6 5.4c.9-.22 1.82.32 2.05 1.25l.46 1.85c.22.9-.32 1.82-1.22 2.05L2.8 13.5 1.8 8.1z"/><circle cx="5" cy="9.5" r="1.05" fill="${INK}"/><rect x="9.4" y="13" width="1.8" height="4.7"/><rect x="5.8" y="17.6" width="9" height="1.7" rx=".85"/><path d="M17.6 7.4a4.2 4.2 0 0 1 0 6.2M19.9 5.6a6.8 6.8 0 0 1 0 9.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  ),
};

// ---------------------------------------------------------------------------
// Per-type metadata: which icon, what colour, what label.
// ---------------------------------------------------------------------------

export interface SubtypeMeta {
  key: IconKey;
  label: string;
  color: string;
}

// Satellites — a cool violet→blue palette so the whole layer still reads as one
// family, with the iconic ISS picked out in white.
export const SAT_META: Record<SatCategory, SubtypeMeta> = {
  station: { key: "sat-station", label: "Space station", color: "#ffffff" },
  starlink: { key: "sat-starlink", label: "Starlink", color: "#60a5fa" },
  oneweb: { key: "sat-oneweb", label: "OneWeb", color: "#818cf8" },
  navigation: { key: "sat-navigation", label: "Navigation", color: "#a78bfa" },
  weather: { key: "sat-weather", label: "Weather", color: "#c084fc" },
  "earth-observation": { key: "sat-eo", label: "Earth imaging", color: "#e879f9" },
  science: { key: "sat-science", label: "Science", color: "#f0abfc" },
  communications: { key: "sat-comms", label: "Comms", color: "#7dd3fc" },
  cubesat: { key: "sat-cubesat", label: "CubeSat", color: "#a5b4fc" },
  debris: { key: "sat-debris", label: "Debris / rocket body", color: "#94a3b8" },
  other: { key: "sat-other", label: "Other", color: "#cbd5e1" },
};

// Planes — a warm amber palette, with helicopters in red and parked craft grey.
export const PLANE_META: Record<PlaneCategory, SubtypeMeta> = {
  airliner: { key: "plane-airliner", label: "Airliner", color: "#fbbf24" },
  regional: { key: "plane-regional", label: "Regional / jet", color: "#fb923c" },
  light: { key: "plane-light", label: "Light aircraft", color: "#fcd34d" },
  helicopter: { key: "plane-helicopter", label: "Helicopter", color: "#f87171" },
  ground: { key: "plane-ground", label: "On ground", color: "#a8a29e" },
};

// Cameras — shape encodes the feed; colour encodes the region (below).
export const CAMERA_FEED_META: Record<CameraFeed, SubtypeMeta> = {
  video: { key: "cam-video", label: "Live video", color: "#67e8f9" },
  still: { key: "cam-still", label: "Still image", color: "#67e8f9" },
};

export interface RegionMeta {
  source: string;
  label: string;
  color: string;
  /** Globe camera position to fly to when jumping to this region. */
  view?: { lat: number; lng: number; altitude: number };
}

// Region tint, keyed by source id. Cyan/green/teal family — distinct from the
// satellite (violet) and plane (amber) layers. `view` powers the region
// quick-jump (altitude tuned so the whole region's cluster is in frame).
export const CAMERA_REGIONS: RegionMeta[] = [
  { source: "tfl", label: "London (TfL)", color: "#22d3ee", view: { lat: 51.5, lng: -0.12, altitude: 0.5 } },
  { source: "caltrans", label: "California", color: "#4ade80", view: { lat: 36.8, lng: -119.7, altitude: 0.95 } },
  { source: "scdot", label: "South Carolina", color: "#2dd4bf", view: { lat: 33.9, lng: -80.9, altitude: 0.6 } },
  { source: "digitraffic", label: "Finland", color: "#38bdf8", view: { lat: 64.5, lng: 26, altitude: 0.9 } },
  { source: "castlerock", label: "US & Canada 511", color: "#0ea5e9", view: { lat: 40, lng: -88, altitude: 1.6 } },
  { source: "tripcheck", label: "Oregon", color: "#10b981", view: { lat: 44, lng: -120.5, altitude: 0.8 } },
  { source: "drivebc", label: "British Columbia", color: "#5eead4", view: { lat: 53.5, lng: -125, altitude: 0.9 } },
];

export const CAMERA_DEFAULT_REGION: RegionMeta = {
  source: "*",
  label: "Other region",
  color: "#67e8f9",
};

/** Region colour for a camera source id (falls back to the default cyan). */
export function cameraRegionColor(source: string): string {
  return (CAMERA_REGIONS.find((r) => r.source === source) ?? CAMERA_DEFAULT_REGION).color;
}
