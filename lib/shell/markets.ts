"use client";
// Open/close state for the Markets slide-in. Framework-light external store, the
// same idiom as lib/shell/coverage.ts — transient (not persisted), opened on
// demand from the rail / ⌘K so it never clutters the globe by default.

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const marketsStore = {
  open() {
    if (open) return;
    open = true;
    emit();
  },
  close() {
    if (!open) return;
    open = false;
    emit();
  },
  toggle() {
    open = !open;
    emit();
  },
  get(): boolean {
    return open;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useMarketsOpen(): boolean {
  return useSyncExternalStore(marketsStore.subscribe, marketsStore.get, marketsStore.get);
}
