"use client";
// Unified world engine — ONE MapLibre GL JS map with globe projection.
//
// Replaces the old two-engine renderer (react-globe.gl GlobeView + MapLibre
// MapView, cross-faded by altitude). MapLibre v5 morphs a spinning 3D globe
// (zoomed out) into a flat street/satellite map (zoomed in) in a single canvas —
// continuous Google-Earth zoom, no cross-fade seam. Every live layer (cameras,
// planes + trails, satellites) is a MapLibre source/layer on this one map.
//
// Identity: calm + light. CARTO Positron is the default basemap; the globe is
// the hero; progressive disclosure keeps it from being dot-soup (cameras are a
// few soft glows far out, materialising into detailed icons on descent).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { WorldObject } from "@/lib/world";
import { overlay } from "@/lib/overlay";
import { useSatellites } from "@/lib/satellites/useSatellites";
import { usePlanes, type PlaneTrail } from "@/lib/planes/usePlanes";
import { useLayers, type LayerState } from "@/lib/layers";
import { useCameraFilter, cameraFilterStore } from "@/lib/cameraFilter";
import LayerControl from "@/components/LayerControl";
import RegionJump, { type RegionView } from "@/components/RegionJump";
import { cameraFeed } from "@/lib/cameras/classify";
import { CAMERA_FEED_META, cameraRegionColor } from "@/lib/icons/svg";
import { BASEMAPS, DEFAULT_BASEMAP, type BasemapKey } from "@/lib/basemaps";
import { toCameraFC, toPlaneFC, toTrailFC, toSatelliteFC } from "@/lib/map/features";
import { loadCameraIcons, loadPlaneIcons } from "@/lib/map/icons";

type Pt = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  available: boolean;
  source: string;
  country: string;
  live: boolean;
};

// Source / layer ids.
const CAM_SRC = "cameras";
const CAM_DOT_LAYER = "camera-dots"; // cheap glows — the zoomed-out representation
const CAM_LAYER = "camera-markers"; // detailed feed/region icons — appear on descent
const PLANE_SRC = "planes";
const PLANE_LAYER = "plane-markers";
const TRAIL_SRC = "trails";
const TRAIL_LAYER = "trail-lines";
const SAT_SRC = "satellites";
const SAT_GLOW_LAYER = "satellite-glow";
const SAT_LAYER = "satellite-core";
const DEM_SRC = "terrain-dem";
const HILLSHADE_LAYER = "hillshade";

// Start zoomed out so the spinning globe is the hero. RegionJump flies inward.
const HOME = { center: [-30, 28] as [number, number], zoom: 1.4 };
const SPIN_MAX_ZOOM = 4; // only auto-rotate while zoomed out this far
const SPIN_DEG_PER_SEC = 4; // calm rotation
const IDLE_RESUME_MS = 4000; // resume spin this long after the last user input

const vis = (on: boolean): "visible" | "none" => (on ? "visible" : "none");

export default function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const rafRef = useRef(0);
  const interactUntilRef = useRef(0);
  const terrainRef = useRef(true);

  const [pts, setPts] = useState<Pt[]>([]);
  const [basemap, setBasemap] = useState<BasemapKey>(DEFAULT_BASEMAP);
  const [terrainOn, setTerrainOn] = useState(true);

  // Live layers (already emit WorldObject[]).
  const satellites = useSatellites();
  const planesLayer = usePlanes();
  const layers = useLayers();
  const camFilter = useCameraFilter();

  // Fetch the camera registry once.
  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setPts(d.cameras as Pt[]))
      .catch(() => setPts([]));
  }, []);

  // Cameras → WorldObject[] (shape = feed, colour = region).
  const cameraObjects = useMemo<WorldObject[]>(
    () =>
      pts.map((p) => {
        const feed = cameraFeed(p.live);
        const meta = CAMERA_FEED_META[feed];
        const color = cameraRegionColor(p.source);
        return {
          kind: "camera",
          id: p.id,
          lat: p.lat,
          lon: p.lon,
          label: p.name,
          color,
          icon: meta.key,
          typeLabel: meta.label,
          meta: { available: p.available, source: p.source, country: p.country, live: p.live, feed },
        };
      }),
    [pts],
  );

  // Apply the camera sub-filters (region + live-only). camFilter is the dep.
  const filteredCameras = useMemo<WorldObject[]>(
    () =>
      cameraObjects.filter((c) =>
        cameraFilterStore.passes((c.meta?.source as string) ?? "", Boolean(c.meta?.live)),
      ),
    [cameraObjects, camFilter],
  );

  // Refs holding the latest data so addAppLayers (called on every style.load,
  // i.e. each basemap swap) can re-seed sources, and clicks can resolve objects.
  const camerasRef = useRef<WorldObject[]>([]);
  camerasRef.current = filteredCameras;
  const planesRef = useRef<WorldObject[]>([]);
  planesRef.current = planesLayer.objects;
  const trailsRef = useRef<PlaneTrail[]>([]);
  trailsRef.current = planesLayer.trails;
  const satsRef = useRef<WorldObject[]>([]);
  satsRef.current = satellites;
  const layersRef = useRef<LayerState>(layers);
  layersRef.current = layers;

  // --- Map helpers (stable; read from refs) --------------------------------

  const applyTerrain = useCallback((map: maplibregl.Map, on: boolean) => {
    try {
      map.setTerrain(on ? { source: DEM_SRC, exaggeration: 1.3 } : null);
    } catch {
      /* terrain can briefly fight a freshly-swapped style; harmless */
    }
    if (map.getLayer(HILLSHADE_LAYER)) {
      map.setLayoutProperty(HILLSHADE_LAYER, "visibility", vis(on));
    }
  }, []);

  const applyVisibility = useCallback((map: maplibregl.Map, l: LayerState) => {
    const set = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis(on));
    };
    set(CAM_DOT_LAYER, l.cameras);
    set(CAM_LAYER, l.cameras);
    set(SAT_GLOW_LAYER, l.satellites);
    set(SAT_LAYER, l.satellites);
    set(TRAIL_LAYER, l.planes);
    set(PLANE_LAYER, l.planes);
  }, []);

  const ensureGeoJSON = useCallback(
    (map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) => {
      const src = map.getSource(id) as GeoJSONSource | undefined;
      if (src) src.setData(data);
      else map.addSource(id, { type: "geojson", data });
    },
    [],
  );

  // Re-add every app source/layer onto the current style. Idempotent, so it runs
  // safely on the first load AND after each basemap swap (setStyle wipes them).
  const addAppLayers = useCallback(
    async (map: maplibregl.Map) => {
      // Force globe projection (a freshly-set style may reset to mercator).
      try {
        map.setProjection({ type: "globe" });
      } catch {
        /* older styles ignore this */
      }

      // Keyless 3D terrain (AWS Terrarium DEM) + hillshade relief.
      if (!map.getSource(DEM_SRC)) {
        map.addSource(DEM_SRC, {
          type: "raster-dem",
          tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 14,
          attribution: "Elevation: Terrain Tiles (AWS Open Data)",
        });
      }
      if (!map.getLayer(HILLSHADE_LAYER)) {
        map.addLayer({
          id: HILLSHADE_LAYER,
          type: "hillshade",
          source: DEM_SRC,
          layout: { visibility: vis(terrainRef.current) },
          paint: {
            "hillshade-exaggeration": 0.4,
            "hillshade-shadow-color": "#52606d",
            "hillshade-highlight-color": "#ffffff",
          },
        });
      }
      applyTerrain(map, terrainRef.current);

      // Symbol icons are wiped by setStyle — re-rasterise/register them.
      await Promise.all([loadCameraIcons(map), loadPlaneIcons(map)]);

      // Sources, seeded from the latest refs.
      ensureGeoJSON(map, TRAIL_SRC, toTrailFC(trailsRef.current));
      ensureGeoJSON(map, SAT_SRC, toSatelliteFC(satsRef.current));
      ensureGeoJSON(map, CAM_SRC, toCameraFC(camerasRef.current));
      ensureGeoJSON(map, PLANE_SRC, toPlaneFC(planesRef.current));

      // Layers, bottom → top.
      if (!map.getLayer(TRAIL_LAYER)) {
        map.addLayer({
          id: TRAIL_LAYER,
          type: "line",
          source: TRAIL_SRC,
          layout: { "line-cap": "round", "line-join": "round", visibility: vis(layersRef.current.planes) },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 10, 2, 15, 3],
            "line-opacity": 0.5,
          },
        });
      }
      if (!map.getLayer(SAT_GLOW_LAYER)) {
        map.addLayer({
          id: SAT_GLOW_LAYER,
          type: "circle",
          source: SAT_SRC,
          layout: { visibility: vis(layersRef.current.satellites) },
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 5, 4, 8, 8, 12],
            "circle-blur": 1,
            "circle-opacity": 0.3,
          },
        });
      }
      if (!map.getLayer(SAT_LAYER)) {
        map.addLayer({
          id: SAT_LAYER,
          type: "circle",
          source: SAT_SRC,
          layout: { visibility: vis(layersRef.current.satellites) },
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 1.6, 4, 2.6, 8, 3.6],
            "circle-opacity": 0.95,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 0.6,
            "circle-stroke-opacity": 0.7,
          },
        });
      }
      if (!map.getLayer(CAM_DOT_LAYER)) {
        map.addLayer({
          id: CAM_DOT_LAYER,
          type: "circle",
          source: CAM_SRC,
          layout: { visibility: vis(layersRef.current.cameras) },
          paint: {
            "circle-color": ["get", "regionColor"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 1.3, 3, 2, 6, 3, 9, 4],
            // Fade the cheap glows out as the detailed markers (minzoom 5) fade in.
            "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 3, 0.65, 5, 0.45, 6, 0],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 0, 0, 5, 0.5],
            "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0, 6, 0.5],
          },
        });
      }
      if (!map.getLayer(CAM_LAYER)) {
        map.addLayer({
          id: CAM_LAYER,
          type: "symbol",
          source: CAM_SRC,
          minzoom: 5,
          layout: {
            // icon name = "cam-<feed>-<regionKey>" — matches loadCameraIcons().
            "icon-image": ["concat", "cam-", ["get", "feed"], "-", ["get", "regionKey"]],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 9, 0.55, 13, 0.7, 17, 0.9],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            visibility: vis(layersRef.current.cameras),
          },
          paint: { "icon-opacity": ["case", ["get", "available"], 1, 0.4] },
        });
      }
      if (!map.getLayer(PLANE_LAYER)) {
        map.addLayer({
          id: PLANE_LAYER,
          type: "symbol",
          source: PLANE_SRC,
          layout: {
            "icon-image": ["concat", "plane-", ["get", "category"]],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 7, 0.6, 11, 0.8, 15, 1],
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            visibility: vis(layersRef.current.planes),
          },
        });
      }

      applyVisibility(map, layersRef.current);
      readyRef.current = true;
    },
    [applyTerrain, applyVisibility, ensureGeoJSON],
  );

  // Click + cursor handlers, wired ONCE. Layer-scoped handlers survive basemap
  // swaps (resolved by layer id at event time), so they must not be re-added.
  const wireInteractions = useCallback((map: maplibregl.Map) => {
    const camClick = (e: maplibregl.MapLayerMouseEvent) => {
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
    };
    map.on("click", CAM_LAYER, camClick);
    map.on("click", CAM_DOT_LAYER, camClick);

    map.on("click", PLANE_LAYER, (e) => {
      const id = (e.features?.[0]?.properties as { id?: string })?.id;
      const plane = planesRef.current.find((p) => p.id === id);
      if (plane) overlay.open(plane);
    });
    map.on("click", SAT_LAYER, (e) => {
      const id = (e.features?.[0]?.properties as { id?: string })?.id;
      const sat = satsRef.current.find((s) => s.id === id);
      if (sat) overlay.open(sat);
    });

    for (const layer of [CAM_LAYER, CAM_DOT_LAYER, PLANE_LAYER, SAT_LAYER]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, []);

  // --- Init (once) ---------------------------------------------------------
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[DEFAULT_BASEMAP].style,
      center: HOME.center,
      zoom: HOME.zoom,
      maxZoom: 18,
      renderWorldCopies: false,
      attributionControl: false,
    });
    mapRef.current = map;
    (window as unknown as { __map?: maplibregl.Map }).__map = map; // debug handle
    (window as unknown as { __overlay?: typeof overlay }).__overlay = overlay;

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    wireInteractions(map);
    map.on("style.load", () => {
      void addAppLayers(map);
    });

    // Pause auto-spin on any direct user input (native events, not programmatic
    // camera moves) — keeps the calm idle rotation from fighting interaction.
    const el = map.getCanvasContainer();
    const markInteract = () => {
      interactUntilRef.current = performance.now() + IDLE_RESUME_MS;
    };
    const inputs: (keyof HTMLElementEventMap)[] = ["mousedown", "wheel", "touchstart", "pointerdown"];
    for (const ev of inputs) el.addEventListener(ev, markInteract, { passive: true });

    // Calm idle rotation: nudge centre longitude while zoomed out + idle.
    let last = performance.now();
    const spin = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (
        performance.now() > interactUntilRef.current &&
        !overlay.get().object &&
        map.getZoom() < SPIN_MAX_ZOOM
      ) {
        const c = map.getCenter();
        map.setCenter([c.lng + SPIN_DEG_PER_SEC * dt, c.lat]);
      }
      rafRef.current = requestAnimationFrame(spin);
    };
    rafRef.current = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(rafRef.current);
      for (const ev of inputs) el.removeEventListener(ev, markInteract);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the canvas sized to the window.
  useEffect(() => {
    const onResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Basemap swap → setStyle; addAppLayers re-runs on the resulting style.load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    readyRef.current = false;
    map.setStyle(BASEMAPS[basemap].style, { diff: false });
  }, [basemap]);

  // Terrain toggle.
  useEffect(() => {
    terrainRef.current = terrainOn;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyTerrain(map, terrainOn);
  }, [terrainOn, applyTerrain]);

  // Layer visibility toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyVisibility(map, layers);
  }, [layers, applyVisibility]);

  // Live data → source updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(CAM_SRC) as GeoJSONSource | undefined)?.setData(toCameraFC(filteredCameras));
  }, [filteredCameras]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(SAT_SRC) as GeoJSONSource | undefined)?.setData(toSatelliteFC(satellites));
  }, [satellites]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(PLANE_SRC) as GeoJSONSource | undefined)?.setData(toPlaneFC(planesLayer.objects));
    (map.getSource(TRAIL_SRC) as GeoJSONSource | undefined)?.setData(toTrailFC(planesLayer.trails));
  }, [planesLayer]);

  // Debug handle for live tuning (basemap / terrain).
  useEffect(() => {
    (
      window as unknown as {
        __worldmap?: { setBasemap: (k: BasemapKey) => void; setTerrain: (on: boolean) => void };
      }
    ).__worldmap = { setBasemap, setTerrain: setTerrainOn };
  }, []);

  // Per-region camera counts for the region quick-jump.
  const regionCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const p of pts) counts[p.source] = (counts[p.source] ?? 0) + 1;
    return counts;
  }, [pts]);

  const flyToRegion = useCallback((view: RegionView) => {
    const map = mapRef.current;
    if (!map) return;
    // Suppress the idle spin through the fly animation.
    interactUntilRef.current = performance.now() + 2400;
    const zoom = Math.max(3, Math.min(9, 9.5 - view.altitude * 4));
    map.flyTo({ center: [view.lng, view.lat], zoom, duration: 1600, essential: true });
  }, []);

  return (
    <div className="world-map">
      <div ref={containerRef} className="map-canvas" />

      <div className="stat-line" data-testid="stat-line">
        {filteredCameras.length === pts.length
          ? `${pts.length.toLocaleString()} cameras`
          : `${filteredCameras.length.toLocaleString()} of ${pts.length.toLocaleString()} cameras`}{" "}
        · {planesLayer.objects.length.toLocaleString()} planes ·{" "}
        {satellites.length.toLocaleString()} satellites
      </div>

      <LayerControl
        counts={{ cameras: pts.length, satellites: satellites.length, planes: planesLayer.objects.length }}
      />

      <RegionJump counts={regionCounts} onJump={flyToRegion} />
    </div>
  );
}
