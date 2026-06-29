"use client";
// One shared, ref-counted poller per signal id. Many widget instances can monitor
// the same source without each opening its own /api/signals/<id> loop: the first
// subscriber starts polling, the last unsubscribe stops it, and the latest
// features stay cached so a re-mounted widget shows data instantly. A thin impure
// shell — the projection logic it feeds lives in lib/console/signals/signalCard.ts.

import { useMemo, useSyncExternalStore } from "react";
import type { SignalFeature } from "@/lib/signals/types";

export interface SignalFeed {
  features: SignalFeature[];
  status: "loading" | "idle" | "error";
  updatedAt: number | null;
}

interface Entry {
  state: SignalFeed;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  refCount: number;
}

const EMPTY: SignalFeed = { features: [], status: "loading", updatedAt: null };
const MIN_REFRESH_MS = 60_000;
const DEFAULT_REFRESH_MS = 5 * 60_000;
const feeds = new Map<string, Entry>();

function ensure(id: string): Entry {
  let e = feeds.get(id);
  if (!e) {
    e = { state: EMPTY, listeners: new Set(), timer: null, refCount: 0 };
    feeds.set(id, e);
  }
  return e;
}

function emit(e: Entry) {
  for (const l of e.listeners) l();
}

function load(id: string, e: Entry) {
  fetch(`/api/signals/${encodeURIComponent(id)}`)
    .then((r) => r.json())
    .then((d) => {
      const features = (d?.features as SignalFeature[]) ?? [];
      e.state = { features, status: "idle", updatedAt: Date.now() };
      emit(e);
    })
    .catch(() => {
      // Keep the last good features; only show "error" if we never had any.
      e.state = {
        features: e.state.features,
        status: e.state.updatedAt ? "idle" : "error",
        updatedAt: e.state.updatedAt,
      };
      emit(e);
    });
}

/** Subscribe to a single signal source's live feature feed. */
export function useSignalFeed(signalId: string, refreshMs = DEFAULT_REFRESH_MS): SignalFeed {
  const subscribe = useMemo(
    () => (cb: () => void) => {
      const e = ensure(signalId);
      e.listeners.add(cb);
      e.refCount += 1;
      if (e.refCount === 1) {
        if (!e.state.updatedAt) e.state = { ...e.state, status: "loading" };
        load(signalId, e);
        e.timer = setInterval(() => load(signalId, e), Math.max(MIN_REFRESH_MS, refreshMs));
      }
      return () => {
        e.listeners.delete(cb);
        e.refCount -= 1;
        if (e.refCount === 0 && e.timer) {
          clearInterval(e.timer);
          e.timer = null;
        }
      };
    },
    [signalId, refreshMs],
  );

  const getSnapshot = useMemo(() => () => ensure(signalId).state, [signalId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
