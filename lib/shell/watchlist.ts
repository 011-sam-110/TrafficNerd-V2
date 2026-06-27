"use client";
// Watchlist / saved places — bookmark the current map view (or a clicked object)
// and recall it later. A persisted external store (the lib/shell idiom) holding a
// small list, with PURE list ops (add/remove, dedupe, cap) that are unit-tested,
// plus a thin impure bridge that composes "the current view" from the live map +
// the mapView/overlay stores and recalls one by flying there.
//
// Reuses: lib/share/url-style view encoding is NOT needed here — we read the live
// MapLibre handle (window.__map, set by WorldMap) + mapViewStore for the basemap +
// overlay for any focused object. Recall drives mapViewStore (setBasemap +
// flyToPoint) — the same fly bridge M5 search uses. No map logic is duplicated.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { mapViewStore } from "@/lib/mapView";
import { overlay } from "@/lib/overlay";
import type { BasemapKey } from "@/lib/basemaps";

/** A saved map view, or a saved (clicked) object's location. */
export interface SavedPlace {
  /** Stable key (dedupe / remove). */
  id: string;
  /** Human label shown in the list. */
  label: string;
  /** "view" = a map camera; "object" = a clicked world object's spot. */
  kind: "view" | "object";
  lat: number;
  lon: number;
  /** Zoom to restore (views carry the live zoom; objects use a sensible close-up). */
  zoom?: number;
  /** Basemap to restore alongside the camera. */
  basemap?: BasemapKey;
  /** For object bookmarks: the source WorldObject id (provenance only). */
  objId?: string;
  /** Epoch ms the bookmark was saved (newest-first ordering). */
  savedAt: number;
}

export const WATCHLIST_CAP = 40;

/** Pure: add an entry (replacing any with the same id), newest-first, capped. */
export function addToWatchlist(
  list: SavedPlace[],
  entry: SavedPlace,
  cap = WATCHLIST_CAP,
): SavedPlace[] {
  const without = list.filter((e) => e.id !== entry.id);
  return [entry, ...without].slice(0, cap);
}

/** Pure: drop an entry by id. */
export function removeFromWatchlist(list: SavedPlace[], id: string): SavedPlace[] {
  return list.filter((e) => e.id !== id);
}

const PERSIST_KEY = "tn.watchlist.v1";
const PERSIST_VERSION = 1;

let state: SavedPlace[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const watchlistStore = {
  add(entry: SavedPlace) {
    state = addToWatchlist(state, entry);
    emit();
  },
  remove(id: string) {
    state = removeFromWatchlist(state, id);
    emit();
  },
  clear() {
    if (state.length === 0) return;
    state = [];
    emit();
  },
  get(): SavedPlace[] {
    return state;
  },
  /** Pull the persisted list back in. Call once, client-side, after mount. */
  hydrate() {
    const saved = loadPersisted<SavedPlace[]>(PERSIST_KEY, PERSIST_VERSION);
    if (Array.isArray(saved)) state = saved;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useWatchlist(): SavedPlace[] {
  return useSyncExternalStore(watchlistStore.subscribe, watchlistStore.get, watchlistStore.get);
}

// --- Impure bridge (client-only) --------------------------------------------

interface MapLike {
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
}

function liveMap(): MapLike | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __map?: MapLike }).__map ?? null;
}

/**
 * Save whatever is focused right now: if a dossier object is open, bookmark its
 * location; otherwise bookmark the live map camera + basemap. Returns the saved
 * entry, or null if there is no live map yet.
 */
export function saveCurrentView(): SavedPlace | null {
  const map = liveMap();
  if (!map) return null;
  const basemap = mapViewStore.get().basemap;
  const obj = overlay.get().object;
  if (obj) {
    const entry: SavedPlace = {
      id: `obj:${obj.id}`,
      label: obj.label || obj.typeLabel || "Saved object",
      kind: "object",
      lat: obj.lat,
      lon: obj.lon,
      zoom: Math.max(map.getZoom(), 11),
      basemap,
      objId: obj.id,
      savedAt: Date.now(),
    };
    watchlistStore.add(entry);
    return entry;
  }
  const c = map.getCenter();
  const entry: SavedPlace = {
    id: `view:${Date.now()}`,
    label: formatViewLabel(c.lat, c.lng),
    kind: "view",
    lat: c.lat,
    lon: c.lng,
    zoom: map.getZoom(),
    basemap,
    savedAt: Date.now(),
  };
  watchlistStore.add(entry);
  return entry;
}

/** Recall a saved place: restore its basemap and fly the globe to it. */
export function recallPlace(entry: SavedPlace): void {
  if (entry.basemap) mapViewStore.setBasemap(entry.basemap);
  mapViewStore.flyToPoint({ lat: entry.lat, lon: entry.lon, zoom: entry.zoom });
}

/** A calm default label for a view bookmark: signed lat/lon to 2dp. */
export function formatViewLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

// --- Panel open/close (ephemeral, not persisted) ----------------------------

let panelOpen = false;
const panelListeners = new Set<() => void>();

export const watchlistPanelStore = {
  open() {
    if (panelOpen) return;
    panelOpen = true;
    for (const l of panelListeners) l();
  },
  close() {
    if (!panelOpen) return;
    panelOpen = false;
    for (const l of panelListeners) l();
  },
  toggle() {
    panelOpen = !panelOpen;
    for (const l of panelListeners) l();
  },
  get(): boolean {
    return panelOpen;
  },
  subscribe(listener: () => void): () => void {
    panelListeners.add(listener);
    return () => {
      panelListeners.delete(listener);
    };
  },
};

export function useWatchlistPanelOpen(): boolean {
  return useSyncExternalStore(
    watchlistPanelStore.subscribe,
    watchlistPanelStore.get,
    watchlistPanelStore.get,
  );
}
