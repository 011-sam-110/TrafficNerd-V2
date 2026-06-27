"use client";
// Shared map-view state (basemap + 3D terrain) plus an imperative fly-to bridge.
//
// WorldMap used to own basemap/terrain as local useState and render its own
// switcher. The calm shell lifts that choice into this store so the thin top bar
// can drive it while WorldMap stays the renderer. `flyTo` is an imperative escape
// hatch: WorldMap registers a callback on mount; the ⌘K palette / rail call
// mapViewStore.flyTo(view) to fly the globe to a region without a prop drill.
//
// Not persisted on purpose — every visit opens on the calm light default basemap
// (persisting it races the async style.load on first paint).

import { useSyncExternalStore } from "react";
import { type BasemapKey, DEFAULT_BASEMAP } from "@/lib/basemaps";

/** A globe camera target (lat/lng + a 0–2 "altitude" the renderer maps to zoom). */
export interface RegionView {
  lat: number;
  lng: number;
  altitude: number;
}

/**
 * A precise point target with an explicit zoom — used by M5 place-search and
 * "near me" to fly to an exact lat/lon, rather than the altitude-tiered RegionView
 * the region presets use. `zoom` defaults to a mid-street level in WorldMap.
 */
export interface PointView {
  lat: number;
  lon: number;
  zoom?: number;
}

/**
 * A cinematic-dive target (SP6). WorldMap turns this into a pitched flyTo via
 * computeDive; `animate=false` (reduced motion) jumps instead. `onArrive` fires
 * when the camera settles, so the dive store can promote diving → landed.
 */
export interface DiveView {
  lat: number;
  lon: number;
}

export interface MapViewState {
  basemap: BasemapKey;
  terrain: boolean;
}

let state: MapViewState = { basemap: DEFAULT_BASEMAP, terrain: true };
let flyToFn: ((view: RegionView) => void) | null = null;
let flyToPointFn: ((view: PointView) => void) | null = null;
let diveToFn: ((view: DiveView, animate: boolean, onArrive: () => void) => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const mapViewStore = {
  setBasemap(basemap: BasemapKey) {
    if (state.basemap === basemap) return;
    state = { ...state, basemap };
    emit();
  },
  setTerrain(on: boolean) {
    if (state.terrain === on) return;
    state = { ...state, terrain: on };
    emit();
  },
  get(): MapViewState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** WorldMap registers its flyTo here on mount. */
  registerFlyTo(fn: ((view: RegionView) => void) | null) {
    flyToFn = fn;
  },
  flyTo(view: RegionView) {
    flyToFn?.(view);
  },
  /** WorldMap registers its point-flyTo here on mount (M5 search / near-me). */
  registerFlyToPoint(fn: ((view: PointView) => void) | null) {
    flyToPointFn = fn;
  },
  flyToPoint(view: PointView) {
    flyToPointFn?.(view);
  },
  /** WorldMap registers its cinematic-dive handler here on mount (SP6). */
  registerDiveTo(fn: ((view: DiveView, animate: boolean, onArrive: () => void) => void) | null) {
    diveToFn = fn;
  },
  diveTo(view: DiveView, animate: boolean, onArrive: () => void) {
    if (diveToFn) diveToFn(view, animate, onArrive);
    else onArrive(); // no map yet → land immediately so the store never hangs
  },
};

export function useMapView(): MapViewState {
  return useSyncExternalStore(mapViewStore.subscribe, mapViewStore.get, mapViewStore.get);
}
