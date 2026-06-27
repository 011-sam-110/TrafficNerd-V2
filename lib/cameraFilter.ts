"use client";
// Camera sub-filters layered under the top-level "Cameras" layer toggle. Same
// framework-light external-store pattern as lib/layers.ts and lib/overlay.ts.
// GlobeView reads this to filter which cameras it renders (globe points + map
// markers); the legend's camera key drives the controls.
//
//   • regions  — per-source visibility (missing source defaults to visible)
//   • liveOnly — show only cameras with a playable live (HLS) stream

import { useSyncExternalStore } from "react";

export interface CameraFilterState {
  regions: Record<string, boolean>;
  liveOnly: boolean;
}

let state: CameraFilterState = {
  regions: { tfl: true, caltrans: true, scdot: true, digitraffic: true, castlerock: true, tripcheck: true, drivebc: true },
  liveOnly: false,
};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const cameraFilterStore = {
  toggleRegion(source: string) {
    const current = state.regions[source] ?? true;
    state = { ...state, regions: { ...state.regions, [source]: !current } };
    emit();
  },
  setLiveOnly(on: boolean) {
    if (state.liveOnly === on) return;
    state = { ...state, liveOnly: on };
    emit();
  },
  /** Whether a camera (by source id + live flag) passes the current filter. */
  passes(source: string, live: boolean): boolean {
    if ((state.regions[source] ?? true) === false) return false;
    if (state.liveOnly && !live) return false;
    return true;
  },
  get(): CameraFilterState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useCameraFilter(): CameraFilterState {
  return useSyncExternalStore(cameraFilterStore.subscribe, cameraFilterStore.get, cameraFilterStore.get);
}
