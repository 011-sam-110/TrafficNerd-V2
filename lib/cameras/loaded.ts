"use client";
// A lightweight snapshot of the cameras currently loaded on the map, so the ⌘K
// "Dive to a live feed" command can pick a known-live one without re-fetching the
// full /api/cameras payload. WorldMap publishes here whenever CamerasFeed lands.
// Now reactive: subscribe() lets widgets (e.g. Cameras widget) rerender on updates.

export interface LoadedCamera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  available: boolean;
  live: boolean;
}

let cams: LoadedCamera[] = [];
const listeners = new Set<() => void>();

export const loadedCamerasStore = {
  set(next: LoadedCamera[]) {
    cams = next;
    for (const fn of listeners) fn();
  },
  get(): LoadedCamera[] {
    return cams;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },
};
