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
import { ICON_SVG, cameraRegionColor, CAMERA_DEFAULT_REGION } from "@/lib/icons/svg";

const KNOWN_REGIONS = ["tfl", "caltrans", "scdot"];
function regionKeyOf(source: string | undefined): string {
  return source && KNOWN_REGIONS.includes(source) ? source : "default";
}

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
    features: cameras.map((c) => {
      const m = (c.meta ?? {}) as { available?: boolean; source?: string; feed?: string };
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
        properties: {
          id: c.id,
          name: c.label,
          available: Boolean(m.available),
          // icon name pieces: shape = feed, colour = region (see loadCameraIcons)
          feed: m.feed === "video" ? "video" : "still",
          regionKey: regionKeyOf(m.source),
        },
      };
    }),
  };
}

// Rasterise an SVG pictogram into an image MapLibre can use as a symbol icon.
function rasterizeIcon(
  svg: string,
  px = 80,
): Promise<{ width: number; height: number; data: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const sized = svg.replace("<svg ", `<svg width="${px}" height="${px}" `);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(image, 0, 0, px, px);
      const d = ctx.getImageData(0, 0, px, px);
      resolve({ width: px, height: px, data: new Uint8Array(d.data.buffer.slice(0)) });
    };
    image.onerror = reject;
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
  });
}

// Register one region-tinted icon per (feed shape × region colour) so the symbol
// layer can pick the right one per camera with a data-driven expression.
async function loadCameraIcons(map: maplibregl.Map): Promise<void> {
  const feeds: [string, keyof typeof ICON_SVG][] = [
    ["still", "cam-still"],
    ["video", "cam-video"],
  ];
  const regions: [string, string][] = [
    ["tfl", cameraRegionColor("tfl")],
    ["caltrans", cameraRegionColor("caltrans")],
    ["scdot", cameraRegionColor("scdot")],
    ["default", CAMERA_DEFAULT_REGION.color],
  ];
  await Promise.all(
    feeds.flatMap(([feed, iconKey]) =>
      regions.map(async ([rk, color]) => {
        const name = `cam-${feed}-${rk}`;
        if (map.hasImage(name)) return;
        const img = await rasterizeIcon(ICON_SVG[iconKey].replaceAll("currentColor", color));
        if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
      }),
    ),
  );
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

    map.on("load", async () => {
      await loadCameraIcons(map);
      readyRef.current = true;
      map.addSource(SRC, { type: "geojson", data: toFeatureCollection(camerasRef.current) });
      map.addLayer({
        id: LAYER,
        type: "symbol",
        source: SRC,
        layout: {
          // icon name = "cam-<feed>-<regionKey>" — matches loadCameraIcons().
          "icon-image": ["concat", "cam-", ["get", "feed"], "-", ["get", "regionKey"]],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 13, 0.6, 17, 0.85],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          // Down feeds render faded; live ones full strength.
          "icon-opacity": ["case", ["get", "available"], 1, 0.4],
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
