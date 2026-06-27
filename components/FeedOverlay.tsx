"use client";
// The dossier — TrafficNerd's right-side slide-in detail panel. Subscribes to the
// overlay store; when an object is open it slides in from the right with a shared
// section layout (header → live media/preview → key facts → context), restyled
// calm + light. Non-modal: the globe stays interactive behind it. Closes via the
// × button and the Esc key; focus moves into the panel and restores on close.

import { useEffect, useRef } from "react";
import { overlay, useOverlay } from "@/lib/overlay";
import { OverlayBody } from "@/lib/overlay-content";

export function FeedOverlay() {
  const { object } = useOverlay();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!object) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") overlay.close();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [object]);

  if (!object) return null;

  return (
    <aside className="tn-dossier" role="dialog" aria-label={object.label}>
      <button className="tn-dossier-close" aria-label="Close" onClick={() => overlay.close()}>
        ×
      </button>
      <div className="tn-dossier-body" ref={panelRef} tabIndex={-1}>
        <OverlayBody object={object} />
      </div>
    </aside>
  );
}
