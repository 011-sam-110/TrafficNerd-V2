"use client";
// The global Scope — the relevance spine. A single persisted store (the lib/shell
// idiom) the feed, the map and (later) the alerts all read: World (firehose) /
// Near-me / Region / AOI. Pure withinScope is unit-tested; the store is a thin
// useSyncExternalStore shell. AOI's bbox is modelled now; the draw interaction is
// P4 — withinScope already handles it so nothing changes when the UI arrives.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { haversineKm } from "@/lib/geo/haversine";

export type ScopeMode = "world" | "near-me" | "region" | "aoi";

export interface Scope {
  mode: ScopeMode;
  /** Centre for near-me / region. */
  center?: { lat: number; lon: number };
  /** Radius (km) for centre-based scopes. */
  radiusKm?: number;
  /** [west, south, east, north] for aoi. */
  bbox?: [number, number, number, number];
  /** Human label for the top bar + the feed's honest empty state. */
  label: string;
}

export const WORLD_SCOPE: Scope = { mode: "world", label: "World" };
export const DEFAULT_RADIUS_KM = 250;
const MIN_RADIUS_KM = 10;

/** Pure: is a point inside the scope? Malformed centre/aoi scopes admit
 *  everything — we never silently hide data we cannot test. */
export function withinScope(lat: number, lon: number, scope: Scope): boolean {
  switch (scope.mode) {
    case "near-me":
    case "region":
      if (!scope.center || scope.radiusKm == null) return true;
      return haversineKm(scope.center.lat, scope.center.lon, lat, lon) <= scope.radiusKm;
    case "aoi": {
      if (!scope.bbox) return true;
      const [w, s, e, n] = scope.bbox;
      return lon >= w && lon <= e && lat >= s && lat <= n;
    }
    case "world":
    default:
      return true;
  }
}

/** Radius (km) covering a geocoder extent [west,south,east,north], floored. */
export function radiusFromBbox(bbox: [number, number, number, number]): number {
  const [w, s, e, n] = bbox;
  const halfDiag = haversineKm(s, w, n, e) / 2;
  return Math.max(MIN_RADIUS_KM, Math.round(halfDiag));
}

/** A persisted near-me rehydrates to World (we never auto-geolocate on load);
 *  region/aoi/world survive; junk → World. */
export function coerceSavedScope(saved: unknown): Scope {
  const s = saved as Scope | null;
  if (!s || typeof s !== "object" || typeof s.mode !== "string") return WORLD_SCOPE;
  if (s.mode === "near-me") return WORLD_SCOPE;
  if (s.mode === "region" || s.mode === "aoi" || s.mode === "world") return s;
  return WORLD_SCOPE;
}

const PERSIST_KEY = "tn.scope.v1";
const PERSIST_VERSION = 1;

let state: Scope = WORLD_SCOPE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const scopeStore = {
  set(scope: Scope) {
    state = scope;
    emit();
  },
  get(): Scope {
    return state;
  },
  reset() {
    state = WORLD_SCOPE;
    emit();
  },
  hydrate() {
    state = coerceSavedScope(loadPersisted<Scope>(PERSIST_KEY, PERSIST_VERSION));
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useScope(): Scope {
  return useSyncExternalStore(scopeStore.subscribe, scopeStore.get, scopeStore.get);
}
