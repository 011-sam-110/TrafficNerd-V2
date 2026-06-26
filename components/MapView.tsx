"use client";
// Real satellite-imagery map (MapLibre GL + Esri World Imagery raster tiles).
// GlobeView cross-fades to this when the globe POV altitude drops below the map
// threshold. Cameras render as exact lng/lat circle markers — this is what makes
// the pins "accurate": they sit on the real carriageway, not a stylised globe.
//
// Lazy-initialised on first activation so Esri tiles aren't fetched until the
// user actually zooms in. Stays mounted (hidden) afterwards for instant return.

import { useEffect, useRef } from "react";
import maplibregl, { type StyleSpecification, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { WorldObject } from "@/lib/world";
import { overlay } from "@/lib/overlay";

const ESRI_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri-imagery", type: "raster", source: "esri-imagery" }],
};

const SRC = "cameras";
const LAYER = "camera-markers";
const MAP_ZOOM = 13;

function toFeatureCollection(cameras: WorldObject[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cameras.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      properties: {
        id: c.id,
        name: c.label,
        available: Boolean((c.meta as { available?: boolean } | undefined)?.available),
      },
    })),
  };
}

export function MapView({
  active,
  center,
  cameras,
}: {
  active: boolean;
  center: { lat: number; lng: number };
  cameras: WorldObject[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;

  // Lazy init on first activation.
  useEffect(() => {
    if (!active || mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: ESRI_STYLE,
      center: [center.lng, center.lat],
      zoom: MAP_ZOOM,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

    map.on("load", () => {
      readyRef.current = true;
      map.addSource(SRC, { type: "geojson", data: toFeatureCollection(camerasRef.current) });
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3, 14, 6, 17, 9],
          "circle-color": ["case", ["get", "available"], "#22d3ee", "#64748b"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#04060c",
          "circle-opacity": 0.95,
        },
      });

      map.on("click", LAYER, (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const [lon, lat] = f.geometry.coordinates as [number, number];
        const p = f.properties as { id: string; name: string; available: boolean | string };
        overlay.open({
          kind: "camera",
          id: p.id,
          lat,
          lon,
          label: p.name,
          meta: { available: p.available === true || p.available === "true" },
        });
      });
      map.on("mouseenter", LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
    });
    // center is intentionally read once at init; the effect below re-centres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Re-centre + resize each time we (re)enter map mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    map.jumpTo({ center: [center.lng, center.lat], zoom: MAP_ZOOM });
    requestAnimationFrame(() => map.resize());
  }, [active, center]);

  // Keep markers in sync once the camera registry has loaded / changed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(toFeatureCollection(cameras));
  }, [cameras]);

  // Keep the canvas sized to the window.
  useEffect(() => {
    const onResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Tear down on unmount.
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  return <div ref={containerRef} className="map-canvas" />;
}
