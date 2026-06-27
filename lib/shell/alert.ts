"use client";
// Persisted dismissal for the breaking-alert banner. We remember the KEY of the
// last alert the user dismissed so the same event never nags again across reloads
// — but a genuinely new alert (different key) still shows. Anti-"crying wolf".

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

const PERSIST_KEY = "tn.alert.v1";
const PERSIST_VERSION = 1;

let dismissedKey: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, dismissedKey);
}

export const alertStore = {
  dismiss(key: string) {
    if (dismissedKey === key) return;
    dismissedKey = key;
    emit();
  },
  isDismissed(key: string): boolean {
    return dismissedKey === key;
  },
  get(): string | null {
    return dismissedKey;
  },
  hydrate() {
    const saved = loadPersisted<string | null>(PERSIST_KEY, PERSIST_VERSION);
    dismissedKey = saved ?? null;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useDismissedAlert(): string | null {
  return useSyncExternalStore(alertStore.subscribe, alertStore.get, alertStore.get);
}
