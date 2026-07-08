// components/InsetMap.tsx
"use client";
// A small, single-layer MapLibre map for detail views: renders one set of point
// features on the keyless CARTO Positron basemap, auto-fits to their bounds, and
// calls onSelect(id) when a point is clicked. Dependency-free beyond maplibre-gl
// (already used by the globe). NOT the 1379-line WorldMap — deliberately minimal.
import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pointsToFC, boundsOf, type InsetPoint } from "@/lib/map/inset";

const SRC = "inset-points";
const LAYER = "inset-point-circles";
const POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export default function InsetMap({
  points,
  height = 320,
  onSelect,
}: {
  points: InsetPoint[];
  height?: number;
  onSelect?: (id: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: boxRef.current,
      style: POSITRON,
      center: [0, 20],
      zoom: 1,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource(SRC, { type: "geojson", data: pointsToFC(points) });
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#0b1220",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      });
      map.on("click", LAYER, (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string" && id) selectRef.current?.(id);
      });
      map.on("mouseenter", LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", LAYER, () => { map.getCanvas().style.cursor = ""; });
      fit(map, points);
    });
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new features + refit when points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    if (src) { src.setData(pointsToFC(points)); fit(map, points); }
  }, [points]);

  return <div ref={boxRef} className="tn-inset-map" style={{ width: "100%", height }} />;
}

function fit(map: maplibregl.Map, points: InsetPoint[]) {
  const b = boundsOf(points);
  if (b) map.fitBounds(b, { padding: 40, maxZoom: 6, duration: 0 });
}
