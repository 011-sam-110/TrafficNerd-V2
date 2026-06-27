"use client";
// Open/close state for the honest-coverage panel. Framework-light external store
// (useSyncExternalStore), the same idiom as lib/overlay.ts / lib/shell/ui.ts. Kept
// ephemeral (not persisted) — it's a transient "show me the numbers" panel.

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const coverageStore = {
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

export function useCoverageOpen(): boolean {
  return useSyncExternalStore(coverageStore.subscribe, coverageStore.get, coverageStore.get);
}
