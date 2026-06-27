"use client";
// Which world layers are currently visible. Framework-light external store
// (useSyncExternalStore), the same pattern as lib/overlay.ts.
//
// WorldMap reads this to decide which MapLibre layers are visible AND — via the
// gating <CamerasFeed>/<PlanesFeed>/<SatellitesFeed> wrappers — whether a layer's
// data hook is even mounted (a hidden layer does not fetch or tick). The left
// LayerRail and the ⌘K palette drive the toggles. Toggle state is persisted to
// localStorage so a composed view survives a reload.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

// Active layers have a live data source today; planned layers render as disabled
// "coming soon" rows in the rail (leaving room without shipping a dead toggle).
export type LayerKey = "cameras" | "satellites" | "planes" | "ships" | "webcams" | "weather";
export type LayerState = Record<LayerKey, boolean>;

export const ACTIVE_LAYERS: readonly LayerKey[] = ["cameras", "planes", "satellites", "webcams"];
export const PLANNED_LAYERS: readonly LayerKey[] = ["ships", "weather"];

const DEFAULT_STATE: LayerState = {
  cameras: true,
  satellites: true,
  planes: true,
  ships: false,
  webcams: false,
  weather: false,
};

const PERSIST_KEY = "tn.layers.v1";
const PERSIST_VERSION = 1;

export type PresetId = "all" | "none" | "cameras" | "air-space";
export const LAYER_PRESETS: { id: PresetId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "none", label: "None" },
  { id: "cameras", label: "Cameras" },
  { id: "air-space", label: "Air + space" },
];

// Presets switch the core cameras/planes/satellites layers. Webcams is active
// (a live toggle) but stays OUT of the presets on purpose: it is a keyed,
// rate-limited global sample, so it stays opt-in rather than being pulled in by
// a one-tap "All". Planned layers (ships/weather) have no data yet.
export function presetState(id: PresetId): LayerState {
  const off: LayerState = { ...DEFAULT_STATE, cameras: false, satellites: false, planes: false };
  switch (id) {
    case "all":
      return { ...off, cameras: true, planes: true, satellites: true };
    case "none":
      return off;
    case "cameras":
      return { ...off, cameras: true };
    case "air-space":
      return { ...off, planes: true, satellites: true };
  }
}

let state: LayerState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const layersStore = {
  toggle(key: LayerKey) {
    state = { ...state, [key]: !state[key] };
    emit();
  },
  set(key: LayerKey, on: boolean) {
    if (state[key] === on) return;
    state = { ...state, [key]: on };
    emit();
  },
  applyPreset(id: PresetId) {
    state = presetState(id);
    emit();
  },
  applyExact(next: LayerState) {
    state = { ...DEFAULT_STATE, ...next };
    emit();
  },
  get(): LayerState {
    return state;
  },
  /** Pull persisted toggles back in. Call once, client-side, after mount. */
  hydrate() {
    const saved = loadPersisted<Partial<LayerState>>(PERSIST_KEY, PERSIST_VERSION);
    if (saved) state = { ...DEFAULT_STATE, ...saved };
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useLayers(): LayerState {
  return useSyncExternalStore(layersStore.subscribe, layersStore.get, layersStore.get);
}
