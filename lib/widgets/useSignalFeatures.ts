"use client";
// Shared widget data hook: fetch a signal source's features through the existing
// generic /api/signals/<id> proxy and poll on a cadence — independent of whether
// the matching map LAYER is toggled on. Dormant-safe: any failure leaves the last
// features in place and flips status to "error". Disabled (enabled=false) never
// fetches, mirroring the hidden-layer-doesn't-fetch contract.

import { useEffect, useState } from "react";
import type { SignalFeature } from "@/lib/signals/types";

export type FeedStatus = "idle" | "loading" | "error";

export interface SignalFeed {
  features: SignalFeature[];
  status: FeedStatus;
  updatedAt: number | null;
}

const DEFAULT_POLL_MS = 5 * 60_000;

export function useSignalFeatures(id: string, enabled: boolean, pollMs = DEFAULT_POLL_MS): SignalFeed {
  const [features, setFeatures] = useState<SignalFeature[]>([]);
  const [status, setStatus] = useState<FeedStatus>("idle");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setStatus("loading");
    const load = () => {
      fetch(`/api/signals/${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setFeatures((d.features as SignalFeature[]) ?? []);
          setStatus("idle");
          setUpdatedAt(Date.now());
        })
        .catch(() => {
          if (alive) setStatus("error");
        });
    };
    load();
    const t = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, enabled, pollMs]);

  return { features, status, updatedAt };
}
