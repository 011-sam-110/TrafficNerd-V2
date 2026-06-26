"use client";
// Which world layers are currently visible. Same framework-light external-store
// pattern as lib/overlay.ts. GlobeView reads this to filter what it renders;
// <LayerControl> (the legend) reads it to drive the on/off toggles.

import { useSyncExternalStore } from "react";

export type LayerKey = "cameras" | "satellites" | "planes";
export type LayerState = Record<LayerKey, boolean>;

let state: LayerState = { cameras: true, satellites: true, planes: true };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
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
  get(): LayerState {
    return state;
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
