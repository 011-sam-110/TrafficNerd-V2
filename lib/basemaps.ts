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

// Esri World Imagery — the photographic deep-zoom layer (also used pre-rewrite).
const ESRI_STYLE: StyleSpecification = {
  version: 8,
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

export const DEFAULT_BASEMAP: BasemapKey = "positron";
