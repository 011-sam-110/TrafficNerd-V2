// Typed basemap registry for the unified MapLibre globe engine.
//
// One map instance, swappable base style. `positron` is the calm light default
// (CARTO Positron vector — morphs globe→mercator natively); `satellite` is the
// Esri World Imagery raster for the deep-zoom photographic payoff; `topo` is a
// keyless OpenTopoMap raster for terrain context. All keyless.
//
// Switching a basemap (`map.setStyle`) wipes every source/layer/image/terrain, so
// WorldMap re-adds the app layers on the `style.load` event — see addAppLayers().

import type { StyleSpecification } from "maplibre-gl";

export type BasemapKey = "positron" | "satellite" | "topo";

export interface BasemapDef {
  key: BasemapKey;
  label: string;
  /** A style URL (vector) or a full inline StyleSpecification (raster). */
  style: string | StyleSpecification;
  /** Vector styles auto-morph globe↔mercator; raster styles still drape the globe. */
  vector: boolean;
}

// Keyless CARTO glyph server (the same one the Positron vector style uses) so
// our own symbol-text layers — the cluster count badges — render on the raster
// basemaps too, which otherwise ship no `glyphs`. "Open Sans Regular" is served
// by this endpoint and by Positron's glyphs, so one font works on all basemaps.
const CARTO_GLYPHS = "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf";

// Esri World Imagery — the photographic deep-zoom layer (also used pre-rewrite).
const ESRI_STYLE: StyleSpecification = {
  version: 8,
  glyphs: CARTO_GLYPHS,
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#0b1220" } },
    { id: "esri-imagery", type: "raster", source: "esri-imagery" },
  ],
};

// OpenTopoMap — keyless topographic raster (relief + contours).
const TOPO_STYLE: StyleSpecification = {
  version: 8,
  glyphs: CARTO_GLYPHS,
  sources: {
    opentopomap: {
      type: "raster",
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: "© OpenTopoMap (CC-BY-SA) · © OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e8eef0" } },
    { id: "opentopomap", type: "raster", source: "opentopomap" },
  ],
};

export const BASEMAPS: Record<BasemapKey, BasemapDef> = {
  positron: {
    key: "positron",
    label: "Light",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    vector: true,
  },
  satellite: {
    key: "satellite",
    label: "Satellite",
    style: ESRI_STYLE,
    vector: false,
  },
  topo: {
    key: "topo",
    label: "Topographic",
    style: TOPO_STYLE,
    vector: false,
  },
};

// Photographic SATELLITE by default — the Esri World Imagery globe is the hero
// view (with our own country borders + names layered on top so the imagery still
// reads geographically). The calm "Light" Positron vector basemap and the
// "Topographic" relief stay one tap away in the basemap switcher. Basemap is not
// persisted (see lib/mapView.ts), so every fresh visit opens here; a deep-link
// `?base=light` still overrides.
export const DEFAULT_BASEMAP: BasemapKey = "satellite";
