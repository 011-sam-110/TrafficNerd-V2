"use client";
// The feed overlay. Subscribes to the overlay store; when an object is open it
// renders a panel ON TOP of the still-running globe with a dimmed backdrop.
// Closes via the X button, the Esc key, and a backdrop click. The globe keeps
// spinning behind it (it's never unmounted).

import { useEffect, useRef } from "react";
import { overlay, useOverlay } from "@/lib/overlay";
import { OverlayBody } from "@/lib/overlay-content";

export function FeedOverlay() {
  const { object } = useOverlay();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!object) return;
    // Remember what was focused, move focus into the panel, restore on close.
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
    <div className="overlay-root" role="dialog" aria-modal="true" aria-label={object.label}>
      <div className="overlay-backdrop" onClick={() => overlay.close()} />
      <div className="overlay-panel" ref={panelRef} tabIndex={-1}>
        <button
          className="overlay-close"
          aria-label="Close feed"
          onClick={() => overlay.close()}
        >
          ×
        </button>
        <OverlayBody object={object} />
      </div>
    </div>
  );
}
