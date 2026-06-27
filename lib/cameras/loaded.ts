"use client";
// A lightweight snapshot of the cameras currently loaded on the map, so the ⌘K
// "Dive to a live feed" command can pick a known-live one without re-fetching the
// full /api/cameras payload. WorldMap publishes here whenever CamerasFeed lands.
// Not reactive on purpose — the command reads it on demand.

export interface LoadedCamera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  available: boolean;
  live: boolean;
}

let cams: LoadedCamera[] = [];

export const loadedCamerasStore = {
  set(next: LoadedCamera[]) {
    cams = next;
  },
  get(): LoadedCamera[] {
    return cams;
  },
};
