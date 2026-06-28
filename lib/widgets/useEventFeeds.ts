"use client";
// Fetch every EVENT_SOURCES feed through the generic /api/signals/<id> proxy on a
// cadence, accumulating the latest features per source. A thin impure shell (no
// unit test — the logic it feeds lives in lib/widgets/eventFeed.ts). Dormant-safe:
// a failed source keeps its last features; status is "error" only if ALL fail.

import { useEffect, useState } from "react";
import type { SignalFeature } from "@/lib/signals/types";
import { EVENT_SOURCES } from "@/lib/events/sources";

export interface RawFeeds {
  bySource: Record<string, SignalFeature[]>;
  status: "idle" | "loading" | "error";
  updatedAt: number | null;
}

const POLL_MS = 5 * 60_000;

export function useEventFeeds(): RawFeeds {
  const [bySource, setBySource] = useState<Record<string, SignalFeature[]>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      setStatus("loading");
      Promise.all(
        EVENT_SOURCES.map((s) =>
          fetch(`/api/signals/${encodeURIComponent(s.id)}`)
            .then((r) => r.json())
            .then((d) => ({ id: s.id, features: (d.features as SignalFeature[]) ?? [], ok: true }))
            .catch(() => ({ id: s.id, features: [] as SignalFeature[], ok: false })),
        ),
      ).then((results) => {
        if (!alive) return;
        setBySource((prev) => {
          const next = { ...prev };
          for (const r of results) if (r.ok) next[r.id] = r.features;
          return next;
        });
        setStatus(results.every((r) => !r.ok) ? "error" : "idle");
        setUpdatedAt(Date.now());
      });
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { bySource, status, updatedAt };
}
