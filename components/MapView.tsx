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
import type { PlaneTrail } from "@/lib/planes/usePlanes";
import { overlay } from "@/lib/overlay";
import { ICON_SVG, cameraRegionColor, CAMERA_DEFAULT_REGION, PLANE_META } from "@/lib/icons/svg";

const KNOWN_REGIONS = ["tfl", "caltrans", "scdot", "digitraffic"];
function regionKeyOf(source: string | undefined): string {
  return source && KNOWN_REGIONS.includes(source) ? source : "default";
}

const PLANE_SRC = "planes";
const PLANE_LAYER = "plane-markers";
const TRAIL_SRC = "trails";
const TRAIL_LAYER = "trail-lines";

function toPlaneFC(planes: WorldObject[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: planes.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        category: (p.meta?.category as string) ?? "airliner",
        heading: p.heading ?? 0,
        color: p.color ?? "#fbbf24",
      },
    })),
  };
}

function toTrailFC(trails: PlaneTrail[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trails
      .filter((t) => t.points.length >= 2)
      .map((t) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: t.points.map((p) => [p[1], p[0]]) },
        properties: { id: t.id, color: t.color },
      })),
  };
}

// Register one heading-up plane icon per type (coloured by PLANE_META).
async function loadPlaneIcons(map: maplibregl.Map): Promise<void> {
  await Promise.all(
    Object.values(PLANE_META).map(async (meta) => {
      if (map.hasImage(meta.key)) return;
      const img = await rasterizeIcon(ICON_SVG[meta.key].replaceAll("currentColor", meta.color));
      if (!map.hasImage(meta.key)) map.addImage(meta.key, img, { pixelRatio: 2 });
    }),
  );
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
    ["digitraffic", cameraRegionColor("digitraffic")],
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
  planes = [],
  trails = [],
}: {
  active: boolean;
  center: { lat: number; lng: number };
  cameras: WorldObject[];
  planes?: WorldObject[];
  trails?: PlaneTrail[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;
  const planesRef = useRef(planes);
  planesRef.current = planes;
  const trailsRef = useRef(trails);
  trailsRef.current = trails;

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
      (window as unknown as { __map?: maplibregl.Map }).__map = map; // debug handle
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

      // --- Planes + breadcrumb trails (FlightRadar-style on the map) ---
      await loadPlaneIcons(map);
      // Trails go UNDER the plane markers.
      map.addSource(TRAIL_SRC, { type: "geojson", data: toTrailFC(trailsRef.current) });
      map.addLayer({
        id: TRAIL_LAYER,
        type: "line",
        source: TRAIL_SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.55 },
      });
      map.addSource(PLANE_SRC, { type: "geojson", data: toPlaneFC(planesRef.current) });
      map.addLayer({
        id: PLANE_LAYER,
        type: "symbol",
        source: PLANE_SRC,
        layout: {
          "icon-image": ["concat", "plane-", ["get", "category"]],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 7, 0.45, 11, 0.7, 15, 1],
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      map.on("click", PLANE_LAYER, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as { id?: string })?.id;
        const plane = planesRef.current.find((p) => p.id === id);
        if (plane) overlay.open(plane);
      });
      map.on("mouseenter", PLANE_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", PLANE_LAYER, () => {
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

  // Keep planes + trails in sync as they move (every poll).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(PLANE_SRC) as GeoJSONSource | undefined)?.setData(toPlaneFC(planes));
    (map.getSource(TRAIL_SRC) as GeoJSONSource | undefined)?.setData(toTrailFC(trails));
  }, [planes, trails]);

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
