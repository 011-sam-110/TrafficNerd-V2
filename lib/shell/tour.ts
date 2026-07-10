"use client";
// Tour store — the tiny piece of state behind the guided walkthrough. Two concerns:
//   1. A PERSISTED "seen" flag (the tour version the visitor last completed) so the
//      auto-run never nags on return visits. Written the moment the tour opens on a
//      first visit (so a mid-tour reload won't re-trigger it) and again when it ends.
//   2. An EPHEMERAL `active` flag the overlay subscribes to; the step index itself is
//      owned by the overlay (it resolves which steps are actually on-screen first).
// Pure gating (shouldAutoRunTour) + the step list live in lib/console/tour.ts.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { TOUR_VERSION, shouldAutoRunTour } from "@/lib/console/tour";

const KEY = "tn.tour.v1";
const VERSION = 1;
interface Persisted { seenVersion: number }

let active = false;
let seenVersion: number | null = null;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

function markSeen() {
  if (seenVersion === TOUR_VERSION) return;
  seenVersion = TOUR_VERSION;
  savePersisted<Persisted>(KEY, VERSION, { seenVersion: TOUR_VERSION });
}

export const tourStore = {
  isActive(): boolean { return active; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Load the persisted "seen" flag (no side effects on the active state). */
  hydrate() { seenVersion = loadPersisted<Persisted>(KEY, VERSION)?.seenVersion ?? null; },
  /** First-run auto-open — a no-op once the visitor has seen this tour version. */
  maybeAutoStart() {
    if (!shouldAutoRunTour(seenVersion)) return;
    markSeen(); // never auto-nag again, even if they reload mid-tour
    if (!active) { active = true; emit(); }
  },
  /** Replay on demand (⌘K / help). Always opens; also settles the seen flag. */
  start() { markSeen(); if (!active) { active = true; emit(); } },
  /** Close the tour (finished or skipped) and remember it was seen. */
  stop() { markSeen(); if (active) { active = false; emit(); } },
};

export function useTourActive(): boolean {
  return useSyncExternalStore(tourStore.subscribe, tourStore.isActive, tourStore.isActive);
}
