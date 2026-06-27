"use client";
// SP6 — the cinematic globe→live-stream dive. Subscribes to the dive store; when
// a camera enters the "diving" phase it flies the map down (via mapViewStore) and
// pre-warms the feed by mounting <CameraDetail> hidden behind a curtain, so HLS is
// already buffered when the card materialises on "landed". Honest by construction:
// the body IS the real CameraDetail (live video / still-with-countdown / offline).

import { useEffect, useRef } from "react";
import { cinematic, useDive } from "@/lib/cinematic/store";
import { mapViewStore } from "@/lib/mapView";
import { CameraDetail } from "@/components/CameraDetail";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function CinematicDive() {
  const { phase, target } = useDive();
  // The id we have already kicked a dive for — guards against re-firing on every
  // render while still in the "diving" phase.
  const kickedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "diving" || !target) {
      if (phase === "idle") kickedForRef.current = null;
      return;
    }
    if (kickedForRef.current === target.id) return;
    kickedForRef.current = target.id;
    const animate = !prefersReducedMotion();
    mapViewStore.diveTo({ lat: target.lat, lon: target.lon }, animate, () => cinematic.land());
  }, [phase, target]);

  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cinematic.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "idle" || !target || target.kind !== "camera") return null;

  return (
    <div className={`tn-dive tn-dive-${phase}`} role="dialog" aria-label={target.label}>
      <div className="tn-dive-card">
        <button className="tn-dive-close" aria-label="Close live feed" onClick={() => cinematic.close()}>
          ×
        </button>
        {/* Mounted during diving too → the <video>/<img> pre-warms behind the curtain. */}
        <CameraDetail object={target} />
        {phase === "diving" && (
          <div className="tn-dive-curtain" aria-hidden>
            <span className="tn-dive-spinner" />
            <span className="tn-dive-curtain-label">Diving to live feed…</span>
          </div>
        )}
      </div>
    </div>
  );
}
