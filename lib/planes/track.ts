"use client";
// Which single aircraft the globe is tracking — the one source of truth shared by
// the Aviation panel (which sets it) and WorldMap (which follows + highlights it).
//
// Lives OUTSIDE any widget on purpose: the track survives maximising another
// widget, switching boards, or collapsing the panel, exactly as asked — the map
// keeps the lock until the user stops it. Persisted so it even survives a reload
// (a plane that has since left coverage simply shows "signal lost" until stopped).
//
// Two modes:
//   • "follow"   — the map gently re-centres on the plane's live position each poll
//                  (auto-spin is suspended while this is active).
//   • "recenter" — the user has grabbed the map, so we stop chasing it; the plane
//                  stays highlighted and a "Recenter" affordance re-arms follow.
// WorldMap flips follow→recenter itself on direct user input; the panel/chip can
// flip it back.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export type TrackMode = "follow" | "recenter";

export interface TrackState {
  /** Tracked plane WorldObject id (e.g. "plane:ab12cd"), or null when idle. */
  id: string | null;
  /** Callsign/label for the on-map chip (captured at track time). */
  label: string;
  mode: TrackMode;
}

const KEY = "tn.planes.track.v1";
const VERSION = 1;

let state: TrackState = { id: null, label: "", mode: "follow" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(KEY, VERSION, state);
}

export const trackStore = {
  get(): TrackState {
    return state;
  },
  /** Start tracking a plane (always begins in gentle-follow mode). */
  track(id: string, label: string) {
    if (state.id === id && state.mode === "follow") return;
    state = { id, label: label || id, mode: "follow" };
    emit();
  },
  /** Stop tracking entirely (auto-spin resumes). */
  stop() {
    if (state.id === null) return;
    state = { id: null, label: "", mode: "follow" };
    emit();
  },
  /** Switch between gentle-follow and manual-recenter without losing the target. */
  setMode(mode: TrackMode) {
    if (state.id === null || state.mode === mode) return;
    state = { ...state, mode };
    emit();
  },
  /** Convenience: is a given plane id the one being tracked? */
  isTracking(id: string): boolean {
    return state.id === id;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Pull the persisted track back in. Call once, client-side, after mount. */
  hydrate() {
    const saved = loadPersisted<TrackState>(KEY, VERSION);
    if (saved && typeof saved.id !== "undefined") {
      state = { id: saved.id, label: saved.label ?? "", mode: saved.mode === "recenter" ? "recenter" : "follow" };
    }
    emit();
  },
};

export function useTrack(): TrackState {
  return useSyncExternalStore(trackStore.subscribe, trackStore.get, trackStore.get);
}
