"use client";
// User map pins — the dropped markers the central search bar and the right-click
// "Add pin here" menu create, and the pin navigator flicks through. Lives outside
// the map so pins persist across board/widget changes and reloads; WorldMap just
// renders them and the navigator drives fly-to. Keyless + self-contained.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export interface MapPin {
  id: string;
  lat: number;
  lon: number;
  label: string;
}

export interface PinsState {
  pins: MapPin[];
  /** The pin the navigator is focused on / the map highlights, or null. */
  activeId: string | null;
}

const KEY = "tn.map.pins.v1";
const VERSION = 1;

let state: PinsState = { pins: [], activeId: null };
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(KEY, VERSION, state);
}

function makeId(): string {
  seq += 1;
  // Date.now is fine in app (browser) code; the +seq guards against same-ms adds.
  return `pin-${Date.now().toString(36)}-${seq}`;
}

/**
 * PURE: the index to move to when cycling. Wraps around; from "nothing selected"
 * a forward step lands on the first pin and a backward step on the last. Returns
 * -1 for an empty list. Unit-tested.
 */
export function cycleIndex(len: number, current: number, dir: 1 | -1): number {
  if (len <= 0) return -1;
  if (current < 0) return dir === 1 ? 0 : len - 1;
  return (current + dir + len) % len;
}

/** A short "lat, lon" fallback label for a hand-dropped pin. */
export function coordLabel(lat: number, lon: number): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

export const pinsStore = {
  get(): PinsState {
    return state;
  },
  /** Add a pin (from search or right-click) and make it the active one. */
  add(lat: number, lon: number, label?: string): MapPin {
    const pin: MapPin = { id: makeId(), lat, lon, label: (label ?? "").trim() || coordLabel(lat, lon) };
    state = { pins: [...state.pins, pin], activeId: pin.id };
    emit();
    return pin;
  },
  remove(id: string) {
    const idx = state.pins.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const pins = state.pins.filter((p) => p.id !== id);
    let activeId = state.activeId;
    if (activeId === id) activeId = pins.length ? pins[Math.min(idx, pins.length - 1)].id : null;
    state = { pins, activeId };
    emit();
  },
  clear() {
    if (state.pins.length === 0) return;
    state = { pins: [], activeId: null };
    emit();
  },
  setActive(id: string | null) {
    if (state.activeId === id) return;
    state = { ...state, activeId: id };
    emit();
  },
  /** Give an existing pin a better label (e.g. once a reverse-geocode resolves). */
  relabel(id: string, label: string) {
    const l = label.trim();
    if (!l) return;
    let changed = false;
    const pins = state.pins.map((p) => (p.id === id ? ((changed = true), { ...p, label: l }) : p));
    if (!changed) return;
    state = { ...state, pins };
    emit();
  },
  /** Move the active selection forward/back and return the newly active pin. */
  cycle(dir: 1 | -1): MapPin | null {
    const { pins } = state;
    if (pins.length === 0) return null;
    const cur = pins.findIndex((p) => p.id === state.activeId);
    const pin = pins[cycleIndex(pins.length, cur, dir)];
    state = { ...state, activeId: pin.id };
    emit();
    return pin;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  hydrate() {
    const saved = loadPersisted<PinsState>(KEY, VERSION);
    if (saved && Array.isArray(saved.pins)) {
      const pins = saved.pins.filter(
        (p): p is MapPin =>
          !!p && typeof p.id === "string" &&
          Number.isFinite(p.lat) && Number.isFinite(p.lon) && typeof p.label === "string",
      );
      const activeId = pins.some((p) => p.id === saved.activeId) ? saved.activeId : null;
      state = { pins, activeId };
    }
    emit();
  },
};

export function useMapPins(): PinsState {
  return useSyncExternalStore(pinsStore.subscribe, pinsStore.get, pinsStore.get);
}
