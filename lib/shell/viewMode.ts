"use client";
// Console (default, flat 2D map) vs Explore (the 3D globe + cinematic dive). One
// persisted store the shell reads to choose chrome, and WorldMap reads to choose
// its MapLibre projection. The redesign flips the default from globe-as-hero to
// console-as-hero (spec §4, §11).

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export type ViewMode = "console" | "explore";
export const DEFAULT_VIEW_MODE: ViewMode = "console";

export function coerceViewMode(saved: unknown): ViewMode {
  return saved === "explore" || saved === "console" ? saved : DEFAULT_VIEW_MODE;
}

const PERSIST_KEY = "tn.viewmode.v1";
const PERSIST_VERSION = 1;

let state: ViewMode = DEFAULT_VIEW_MODE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const viewModeStore = {
  set(m: ViewMode) {
    if (state === m) return;
    state = m;
    emit();
  },
  toggle() {
    state = state === "console" ? "explore" : "console";
    emit();
  },
  get(): ViewMode {
    return state;
  },
  hydrate() {
    state = coerceViewMode(loadPersisted<ViewMode>(PERSIST_KEY, PERSIST_VERSION));
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useViewMode(): ViewMode {
  return useSyncExternalStore(viewModeStore.subscribe, viewModeStore.get, viewModeStore.get);
}
