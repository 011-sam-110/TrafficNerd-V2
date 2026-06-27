"use client";
// Which global-signal layers are currently ON. A framework-light external store
// (useSyncExternalStore), MIRRORING lib/layers.ts — but kept SEPARATE on purpose:
// the core cameras/planes/satellites/webcams toggles must stay untouched, and
// signals are heavy, global, opt-in extras that DEFAULT ALL OFF.
//
// Keyed by the registry source id (an arbitrary string), so adding a layer needs
// no edit here. Like the core layers, a signal that is OFF is never fetched —
// WorldMap mounts each signal's <SignalFeed> only while its id is on. State is
// persisted to localStorage so a composed view survives a reload.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

/** Map of signal id → on/off. A missing id reads as off (default). */
export type SignalState = Record<string, boolean>;

const PERSIST_KEY = "tn.signals.v1";
const PERSIST_VERSION = 1;

let state: SignalState = {};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const signalsStore = {
  isOn(id: string): boolean {
    return state[id] === true;
  },
  toggle(id: string) {
    state = { ...state, [id]: !state[id] };
    emit();
  },
  set(id: string, on: boolean) {
    if ((state[id] === true) === on) return;
    state = { ...state, [id]: on };
    emit();
  },
  applyExact(next: SignalState) {
    state = { ...next };
    emit();
  },
  get(): SignalState {
    return state;
  },
  /** Pull persisted toggles back in. Call once, client-side, after mount. */
  hydrate() {
    const saved = loadPersisted<SignalState>(PERSIST_KEY, PERSIST_VERSION);
    if (saved) state = { ...saved };
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useSignals(): SignalState {
  return useSyncExternalStore(signalsStore.subscribe, signalsStore.get, signalsStore.get);
}

// --- Live per-signal counts -------------------------------------------------
// Mirrors lib/metrics.ts: the gating <SignalFeed> children push their loaded
// feature counts here so the rail can show a live count beside each toggle
// without WorldMap threading props back out. set(id, null) clears (layer off).

export type SignalCounts = Record<string, number>;

let counts: SignalCounts = {};
const countListeners = new Set<() => void>();

export const signalCountsStore = {
  set(id: string, count: number | null) {
    if (count == null) {
      if (!(id in counts)) return;
      const next = { ...counts };
      delete next[id];
      counts = next;
    } else {
      if (counts[id] === count) return;
      counts = { ...counts, [id]: count };
    }
    for (const l of countListeners) l();
  },
  get(): SignalCounts {
    return counts;
  },
  subscribe(listener: () => void): () => void {
    countListeners.add(listener);
    return () => {
      countListeners.delete(listener);
    };
  },
};

export function useSignalCounts(): SignalCounts {
  return useSyncExternalStore(signalCountsStore.subscribe, signalCountsStore.get, signalCountsStore.get);
}
