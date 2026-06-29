"use client";
// Minimal JSON polling hook for the handful of one-shot console widgets that read
// a whole-payload endpoint (markets, headlines) rather than a signal feed. Keeps
// the last good payload on a failed refresh; "error" only before the first success.

import { useEffect, useState } from "react";

export type PollStatus = "loading" | "idle" | "error";

export function useJsonPoll<T>(url: string, pollMs: number, initial: T): { data: T; status: PollStatus } {
  const [data, setData] = useState<T>(initial);
  const [status, setStatus] = useState<PollStatus>("loading");

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setData(d as T);
          setStatus("idle");
        })
        .catch(() => {
          if (!alive) return;
          setStatus((s) => (s === "loading" ? "error" : s));
        });
    };
    load();
    const t = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, pollMs]);

  return { data, status };
}
