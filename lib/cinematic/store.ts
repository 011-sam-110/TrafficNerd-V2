"use client";
// The cinematic-dive store (SP6). Mirrors lib/overlay.ts: a tiny external store +
// useSyncExternalStore, no new dependency. Camera clicks call cinematic.dive(obj);
// <CinematicDive> drives the fly + pre-warm and calls land() on arrival; close()
// dismisses the hero card (revealing the live street-level map underneath).
//
// Three phases, deliberately: idle (no dive), diving (flying + pre-warming the
// hidden feed), landed (hero card materialised, stream playing). There is no
// "fly back out" on close — the user stays put on the live map (YAGNI; avoids a
// disorienting second animation).

import { useSyncExternalStore } from "react";
import type { WorldObject } from "@/lib/world";

export type DivePhase = "idle" | "diving" | "landed";

export interface DiveState {
  phase: DivePhase;
  target: WorldObject | null;
}

let state: DiveState = { phase: "idle", target: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const cinematic = {
  /** Begin a dive to `target` (or re-target if one is in progress / landed). */
  dive(target: WorldObject) {
    state = { phase: "diving", target };
    emit();
  },
  /** Arrival: promote the in-flight dive to a landed hero card. No-op otherwise. */
  land() {
    if (state.phase !== "diving") return;
    state = { ...state, phase: "landed" };
    emit();
  },
  /** Dismiss the hero card and reset. */
  close() {
    if (state.phase === "idle" && state.target === null) return;
    state = { phase: "idle", target: null };
    emit();
  },
  get(): DiveState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** React hook: re-renders the caller on any dive-phase change. */
export function useDive(): DiveState {
  return useSyncExternalStore(cinematic.subscribe, cinematic.get, cinematic.get);
}
