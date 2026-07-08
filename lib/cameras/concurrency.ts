"use client";
// Caps how many live HLS players run at once — a wall of 50 hls.js players would
// crush the browser, so live is click-to-activate and the oldest slot is evicted
// past the cap. The eviction maths is pure (unit-tested); the store is a thin shell.
import { useSyncExternalStore } from "react";

export const HLS_CAP = 6;

/** Pure: activate `id` in an LRU-ish active list, evicting the oldest past `cap`. */
export function nextActive(active: string[], id: string, cap: number = HLS_CAP): string[] {
  const without = active.filter((x) => x !== id);
  const next = [...without, id]; // most-recent last
  return next.length > cap ? next.slice(next.length - cap) : next;
}

let active: string[] = [];
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export const hlsSlots = {
  activate(id: string) { active = nextActive(active, id); emit(); },
  deactivate(id: string) { active = active.filter((x) => x !== id); emit(); },
  get(): string[] { return active; },
  subscribe(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); },
};

export function useHlsActive(id: string): boolean {
  const list = useSyncExternalStore(hlsSlots.subscribe, hlsSlots.get, hlsSlots.get);
  return list.includes(id);
}
