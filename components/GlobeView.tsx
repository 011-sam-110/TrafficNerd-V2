"use client";
// Composition root for the live world. ONE <Globe> instance renders every
// layer:
//   • cameras  → pointsData, precise markers ON the surface
//   • objects  → objectsData: satellites (compressed altitude shell, emissive
//                marker) + planes (triangle oriented to heading). The DATA array
//                is an integration seam (orchestrator wires it); the RENDERING
//                for both kinds is fully implemented below.
// Clicking anything calls overlay.open(worldObject). When the POV altitude drops
// below MAP_THRESHOLD we cross-fade to <MapView> (real Esri satellite imagery).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import type { WorldObject } from "@/lib/world";
import { overlay } from "@/lib/overlay";
import { altKmToShell, planeKmToShell } from "@/lib/altitude";
import { MapView } from "@/components/MapView";
import { useSatellites } from "@/lib/satellites/useSatellites";
import { usePlanes } from "@/lib/planes/usePlanes";
import { useLayers } from "@/lib/layers";
import LayerControl from "@/components/LayerControl";
import { satelliteSprite, planeIconMesh } from "@/lib/icons/sprite";
import { classifyCameraFeed } from "@/lib/cameras/classify";
import { CAMERA_FEED_META, cameraRegionColor } from "@/lib/icons/svg";

type Pt = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  available: boolean;
  source: string;
  country: string;
  mediaType: "jpeg" | "video" | "both";
};

// London — where P0's cameras are. Fly here on load so the points are front and
// centre instead of a speck off the coast of Africa.
const HOME = { lat: 51.5, lng: -0.12, altitude: 1.6 };
// Below this POV altitude we swap the stylised globe for real Esri satellite
// tiles. Tuned so a couple of scroll-in steps from HOME triggers the swap.
const MAP_THRESHOLD = 0.4;
// Fly back out to here on "↩ Globe" — safely above MAP_THRESHOLD so we don't
// immediately re-enter map mode mid-animation.
const EXIT_ALTITUDE = 1.4;

const CAMERA_OFF = "#64748b";
const SAT_COLOR = "#cbd5e1";
const PLANE_COLOR = "#fbbf24";

// Stable empty-array reference for hidden layers (avoids needless Globe re-diffs).
const EMPTY: WorldObject[] = [];

export default function GlobeView() {
  const [pts, setPts] = useState<Pt[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mapMode, setMapMode] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number }>({
    lat: HOME.lat,
    lng: HOME.lng,
  });
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  // Ignore zoom callbacks for a moment after returning to the globe, so the
  // fly-out animation (which passes through low altitudes) doesn't re-trigger.
  const suppressUntil = useRef(0);

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setPts(d.cameras as Pt[]))
      .catch(() => setPts([]));
  }, []);

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Cameras → WorldObject[] (surface pins). Shared with the map markers, which
  // render the full per-type SVG icon (shape = feed, colour = region). On the
  // globe itself cameras stay cheap region-coloured points (they can number in
  // the thousands), so the icon detail appears the moment you zoom into the map.
  const cameraObjects = useMemo<WorldObject[]>(
    () =>
      pts.map((p) => {
        const feed = classifyCameraFeed(p.mediaType);
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
          meta: {
            available: p.available,
            source: p.source,
            country: p.country,
            mediaType: p.mediaType,
            feed,
            color,
            icon: meta.key,
          },
        };
      }),
    [pts],
  );

  // Live layers: satellites (CelesTrak TLE → SGP4, propagated client-side so they
  // revolve smoothly) + planes (OpenSky, polled ~15s). Both already emit
  // WorldObject[]; the altitude-shell + oriented-object rendering is below.
  const satellites = useSatellites();
  const planes = usePlanes();
  const layers = useLayers();

  // Apply the legend's show/hide toggles.
  const visibleCameras = layers.cameras ? cameraObjects : EMPTY;
  const objects = useMemo<WorldObject[]>(
    () => [
      ...(layers.satellites ? satellites : []),
      ...(layers.planes ? planes : []),
    ],
    [layers.satellites, layers.planes, satellites, planes],
  );

  const handleReady = () => {
    const g = globeRef.current;
    if (!g) return;
    (window as unknown as { __globe?: GlobeMethods }).__globe = g; // debug handle
    (window as unknown as { __overlay?: typeof overlay }).__overlay = overlay; // debug: open feed overlay
    g.pointOfView(HOME, 0);
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.enableDamping = true;
  };

  const handleZoom = useCallback(
    (pov: { lat: number; lng: number; altitude: number }) => {
      if (Date.now() < suppressUntil.current) return;
      if (!mapMode && pov.altitude < MAP_THRESHOLD) {
        setFocus({ lat: pov.lat, lng: pov.lng });
        setMapMode(true);
        const c = globeRef.current?.controls();
        if (c) c.autoRotate = false; // globe is hidden behind the map — save CPU
      }
    },
    [mapMode],
  );

  const returnToGlobe = useCallback(() => {
    suppressUntil.current = Date.now() + 1200;
    setMapMode(false);
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: EXIT_ALTITUDE }, 900);
    const c = g.controls();
    if (c) c.autoRotate = true;
  }, [focus]);

  const objectThreeObject = useCallback((o: object) => {
    const w = o as WorldObject;
    if (w.kind === "satellite")
      return satelliteSprite(w.icon ?? "sat-other", w.color ?? SAT_COLOR);
    if (w.kind === "plane")
      return planeIconMesh(w.icon ?? "plane-airliner", w.color ?? PLANE_COLOR);
    return new THREE.Object3D();
  }, []);

  return (
    <div className="world-stage">
      <div className="stat-line" data-testid="stat-line">
        {pts.length.toLocaleString()} cameras · 3 sources ·{" "}
        {mapMode ? "satellite map" : "London live"}
      </div>

      <LayerControl
        counts={{ cameras: pts.length, satellites: satellites.length, planes: planes.length }}
      />

      <Globe
        ref={globeRef}
        width={size.w || undefined}
        height={size.h || undefined}
        onGlobeReady={handleReady}
        onZoom={handleZoom}
        globeImageUrl="/textures/earth-night.jpg"
        bumpImageUrl="/textures/earth-topology.png"
        backgroundImageUrl="/textures/night-sky.png"
        showAtmosphere
        atmosphereColor="#3a86ff"
        atmosphereAltitude={0.18}
        // --- Cameras: precise markers sitting ON the surface ---
        pointsData={visibleCameras}
        pointLat="lat"
        pointLng="lon"
        pointColor={(o) => {
          const w = o as WorldObject;
          // Region colour when live; muted grey when the feed is down.
          return w.meta?.available ? w.color ?? CAMERA_OFF : CAMERA_OFF;
        }}
        pointAltitude={0.002}
        pointRadius={0.12}
        pointResolution={8}
        pointLabel={(o) => (o as WorldObject).label}
        onPointClick={(o) => overlay.open(o as WorldObject)}
        // --- Satellites + planes: altitude shell + oriented 3D objects ---
        objectsData={objects}
        objectLat="lat"
        objectLng="lon"
        objectAltitude={(o) => {
          const w = o as WorldObject;
          return w.kind === "satellite"
            ? altKmToShell(w.altKm ?? 0)
            : planeKmToShell(w.altKm ?? 0);
        }}
        objectRotation={(o) => {
          const w = o as WorldObject;
          // Heading is clockwise from north; +Z is radial-out, so -heading turns
          // the north-pointing nose toward the compass course (see builders).
          return w.kind === "plane" ? { x: 0, y: 0, z: -(w.heading ?? 0) } : null;
        }}
        objectThreeObject={objectThreeObject}
        objectLabel={(o) => (o as WorldObject).label}
        onObjectClick={(o) => overlay.open(o as WorldObject)}
      />

      <div className={`map-layer${mapMode ? " is-active" : ""}`} aria-hidden={!mapMode}>
        <MapView active={mapMode} center={focus} cameras={visibleCameras} />
      </div>

      {mapMode && (
        <button className="globe-return" onClick={returnToGlobe} aria-label="Return to globe">
          ↩ Globe
        </button>
      )}
    </div>
  );
}
