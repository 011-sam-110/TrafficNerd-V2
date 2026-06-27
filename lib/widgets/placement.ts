"use client";
// Which widget keys are currently placed in the workspace (ordered). The ▦ Widget
// axis of the Source Catalog writes here; the Workspace renders from here. Persisted
// so a composed board survives reload. Pure reducers (node-tested) + a thin store.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

const PERSIST_KEY = "tn.widgets.v1";
const PERSIST_VERSION = 1;

export function addKey(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys : [...keys, key];
}
export function removeKey(keys: string[], key: string): string[] {
  return keys.filter((k) => k !== key);
}

let keys: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, keys);
}

export const placementStore = {
  get(): string[] {
    return keys;
  },
  has(key: string): boolean {
    return keys.includes(key);
  },
  add(key: string) {
    const next = addKey(keys, key);
    if (next === keys) return;
    keys = next;
    emit();
  },
  remove(key: string) {
    const next = removeKey(keys, key);
    if (next.length === keys.length) return;
    keys = next;
    emit();
  },
  toggle(key: string) {
    keys = keys.includes(key) ? removeKey(keys, key) : addKey(keys, key);
    emit();
  },
  hydrate() {
    const saved = loadPersisted<string[]>(PERSIST_KEY, PERSIST_VERSION);
    if (Array.isArray(saved)) keys = saved;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function usePlacement(): string[] {
  return useSyncExternalStore(placementStore.subscribe, placementStore.get, placementStore.get);
}
