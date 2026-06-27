"use client";
// Live global-pulse counters, lifted into one external store so the top status
// bar, the left rail and the freshness ticker all read a single source of truth
// instead of threading props through WorldMap. WorldMap pushes counts in via
// metricsStore.set(); the chrome subscribes with useMetrics().
//
// set() is shallow-equal guarded so the per-second satellite tick (a new array
// each frame, identical length) never re-renders the chrome.

import { useSyncExternalStore } from "react";

export interface Metrics {
  /** Cameras whose feed is currently reachable. */
  camerasOnline: number;
  /** Cameras in the registry, regardless of health. */
  camerasTotal: number;
  planes: number;
  satellites: number;
}

let state: Metrics = { camerasOnline: 0, camerasTotal: 0, planes: 0, satellites: 0 };
const listeners = new Set<() => void>();

function shallowEqual(a: Metrics, b: Metrics): boolean {
  return (
    a.camerasOnline === b.camerasOnline &&
    a.camerasTotal === b.camerasTotal &&
    a.planes === b.planes &&
    a.satellites === b.satellites
  );
}

export const metricsStore = {
  set(partial: Partial<Metrics>) {
    const next = { ...state, ...partial };
    if (shallowEqual(next, state)) return;
    state = next;
    for (const l of listeners) l();
  },
  get(): Metrics {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useMetrics(): Metrics {
  return useSyncExternalStore(metricsStore.subscribe, metricsStore.get, metricsStore.get);
}
