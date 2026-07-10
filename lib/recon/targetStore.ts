"use client";
// The one shared OSINT target every recon widget reads and writes. Type a domain /
// IP / ASN into ANY of the six tool cards and all of them re-resolve it. A tiny
// framework-light external store (useSyncExternalStore), mirroring lib/signals/store.ts.
// Not persisted: a recon target is a transient lookup, not a saved view.

import { useSyncExternalStore } from "react";
import { detectKind, normalizeTarget, type TargetKind } from "@/lib/recon/target";

export interface ReconTarget {
  /** Raw text the user typed (what the input shows). */
  raw: string;
  /** Classified kind of the trimmed input. */
  kind: TargetKind;
  /** Normalised value for lookups (lower-cased host, AS-prefix stripped), "" when empty. */
  value: string;
}

const EMPTY: ReconTarget = { raw: "", kind: "empty", value: "" };
let state: ReconTarget = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const reconTargetStore = {
  set(raw: string) {
    const kind = detectKind(raw);
    const next: ReconTarget = { raw, kind, value: kind === "empty" ? "" : normalizeTarget(raw, kind) };
    if (next.raw === state.raw && next.kind === state.kind && next.value === state.value) return;
    state = next;
    emit();
  },
  get(): ReconTarget {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useReconTarget(): ReconTarget {
  return useSyncExternalStore(reconTargetStore.subscribe, reconTargetStore.get, () => EMPTY);
}
