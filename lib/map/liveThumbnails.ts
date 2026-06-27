"use client";
// SP6 — live thumbnail markers. Above THUMB_MIN_ZOOM, a small capped pool of HTML
// markers shows the live still poster for in-viewport cameras, so streams are
// visible at a glance (not buried behind a click). The pure selectThumbnails is
// node-tested; the manager is the side-effecting maplibregl.Marker pool, verified
// via the browser. queryRenderedFeatures already restricts to the visible viewport
// and returns [] if the layer is absent, so this is safe before layers load.

import maplibregl from "maplibre-gl";

export interface ThumbCandidate {
  id: string;
  lon: number;
  lat: number;
  name: string;
}

/** Below this zoom, no thumbnails (would be dot-soup / wasted image loads). */
export const THUMB_MIN_ZOOM = 12;
/** Hard cap on simultaneous thumbnail markers (perf guard). */
export const MAX_THUMBS = 24;

/** De-dupe by id (first wins) and cap at `max`, preserving input order. */
export function selectThumbnails(candidates: ThumbCandidate[], max: number): ThumbCandidate[] {
  const seen = new Set<string>();
  const out: ThumbCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

export interface ThumbDeps {
  map: maplibregl.Map;
  layerId: string;
  onPick: (c: ThumbCandidate) => void;
}

export function createThumbnailManager(deps: ThumbDeps): { update(): void; destroy(): void } {
  const { map, layerId, onPick } = deps;
  const markers = new Map<string, maplibregl.Marker>();

  const buildEl = (c: ThumbCandidate): HTMLElement => {
    const el = document.createElement("button");
    el.className = "tn-thumb";
    el.type = "button";
    el.setAttribute("aria-label", `Live feed: ${c.name}`);
    const img = document.createElement("img");
    img.className = "tn-thumb-img";
    img.loading = "lazy";
    img.alt = "";
    img.src = `/api/proxy?id=${encodeURIComponent(c.id)}`;
    img.addEventListener("error", () => { el.classList.add("tn-thumb-failed"); });
    el.appendChild(img);
    el.addEventListener("click", (ev) => { ev.stopPropagation(); onPick(c); });
    return el;
  };

  const clear = () => {
    for (const m of markers.values()) m.remove();
    markers.clear();
  };

  const update = () => {
    if (!map.getLayer(layerId) || map.getZoom() < THUMB_MIN_ZOOM) {
      if (markers.size) clear();
      return;
    }
    let raw: maplibregl.MapGeoJSONFeature[] = [];
    try {
      raw = map.queryRenderedFeatures({ layers: [layerId] });
    } catch {
      raw = [];
    }
    const candidates: ThumbCandidate[] = [];
    for (const f of raw) {
      if (f.geometry.type !== "Point") continue;
      const props = f.properties as { id?: string; name?: string; available?: boolean | string } | null;
      if (!props?.id) continue;
      // `available` (a working feed) is what toCameraFC emits; the /api/proxy
      // poster works for both live-video and still cameras, so any available
      // camera gets a thumbnail — the goal is to SEE the feeds at a glance.
      const available = props.available === true || props.available === "true";
      if (!available) continue;
      const [lon, lat] = f.geometry.coordinates as [number, number];
      candidates.push({ id: props.id, lon, lat, name: props.name ?? "Camera" });
    }
    const wanted = selectThumbnails(candidates, MAX_THUMBS);
    const wantedIds = new Set(wanted.map((c) => c.id));
    for (const [id, m] of markers) {
      if (!wantedIds.has(id)) { m.remove(); markers.delete(id); }
    }
    for (const c of wanted) {
      if (markers.has(c.id)) continue;
      const m = new maplibregl.Marker({ element: buildEl(c), anchor: "bottom" })
        .setLngLat([c.lon, c.lat])
        .addTo(map);
      markers.set(c.id, m);
    }
  };

  const destroy = () => clear();
  return { update, destroy };
}
