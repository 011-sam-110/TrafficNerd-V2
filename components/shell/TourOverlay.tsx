"use client";
// The guided-tour overlay — a self-contained spotlight/coach-mark walkthrough (no
// third-party tour library). It reads the active flag from tourStore, resolves which
// TOUR_STEPS are actually on-screen, then for each step dims the app and either draws
// a ring around the target element or (for "center" steps) frames a calm card in the
// middle. Fully keyboard-driven: Esc closes, ←/→ + Enter walk the steps, Tab is trapped
// inside the card. Pure step data + gating live in lib/console/tour.ts.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { tourStore, useTourActive } from "@/lib/shell/tour";
import { TOUR_STEPS, resolveTourSteps, clampStep, isLastStep, type TourStep } from "@/lib/console/tour";

interface Box { left: number; top: number; width: number; height: number }

const PAD = 8; // breathing room around the spotlit target + viewport edges
const CARD_GAP = 14; // gap between the target and the coach-mark card

/** Measure a step's target; null for target-less / "center" steps or a missing node. */
function measure(step: TourStep): Box | null {
  if (!step || step.target === "" || step.placement === "center") return null;
  const el = document.querySelector(step.target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

/** Place the card near the box per placement, clamped to the viewport. */
function placeCard(box: Box | null, step: TourStep, cardW: number, cardH: number): { left: number; top: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clamp = (v: number, max: number) => Math.max(PAD, Math.min(v, max - PAD));
  if (!box) return { left: clamp((vw - cardW) / 2, vw - cardW), top: clamp((vh - cardH) / 2, vh - cardH) };
  const place = step.placement ?? "bottom";
  let left: number, top: number;
  if (place === "right") { left = box.left + box.width + CARD_GAP; top = box.top; }
  else if (place === "left") { left = box.left - cardW - CARD_GAP; top = box.top; }
  else if (place === "top") { left = box.left + box.width / 2 - cardW / 2; top = box.top - cardH - CARD_GAP; }
  else { left = box.left + box.width / 2 - cardW / 2; top = box.top + box.height + CARD_GAP; } // bottom
  return { left: clamp(left, vw - cardW), top: clamp(top, vh - cardH) };
}

export default function TourOverlay() {
  const active = useTourActive();
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // On open: resolve the steps whose targets are actually present (a widget column
  // hidden at a narrow width is skipped) and start at the top.
  useEffect(() => {
    if (!active) return;
    const visible = resolveTourSteps(TOUR_STEPS, (sel) => !!document.querySelector(sel));
    setSteps(visible.length ? visible : TOUR_STEPS.filter((s) => s.target === ""));
    setIndex(0);
  }, [active]);

  const step = steps[index];

  // Re-measure the current target on step change, resize and scroll (the chrome is
  // fixed, but the map/segments can reflow). A rAF lets any layout settle first.
  useEffect(() => {
    if (!active || !step) return;
    const update = () => setBox(measure(step));
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [active, step]);

  // Position the card once it (and the target box) are measured.
  useLayoutEffect(() => {
    if (!active || !step) return;
    const el = cardRef.current;
    if (!el) return;
    setPos(placeCard(box, step, el.offsetWidth, el.offsetHeight));
  }, [active, step, box]);

  const stop = useCallback(() => tourStore.stop(), []);
  const go = useCallback((delta: number) => {
    setIndex((i) => {
      const next = i + delta;
      if (next >= steps.length) { tourStore.stop(); return i; }
      return clampStep(next, steps.length);
    });
  }, [steps.length]);

  // Focus the card when a step appears (keeps the keyboard on the overlay).
  useEffect(() => { if (active && step) cardRef.current?.focus(); }, [active, step]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); stop(); return; }
    if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); return; }
    if (e.key === "Tab") {
      // Trap focus inside the card.
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === first || activeEl === cardRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus(); }
    }
  };

  if (!active || !step) return null;
  const last = isLastStep(index, steps.length);
  const plain = !box; // center / target-less framing card

  return (
    <div className="tn-tour" role="dialog" aria-modal="true" aria-labelledby="tn-tour-title" aria-describedby="tn-tour-body" onKeyDown={onKeyDown}>
      <div className={`tn-tour-veil${plain ? " is-plain" : ""}`} onClick={stop} aria-hidden />
      {box && (
        <div className="tn-tour-ring" aria-hidden
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
      )}
      <div className="tn-tour-card" ref={cardRef} tabIndex={-1}
        style={pos ? { left: pos.left, top: pos.top, visibility: "visible" } : { visibility: "hidden" }}>
        <div className="tn-tour-meta">
          <span className="tn-tour-count">Step {index + 1} of {steps.length}</span>
          <button type="button" className="tn-tour-skip" onClick={stop}>Skip tour</button>
        </div>
        <h2 id="tn-tour-title" className="tn-tour-title">{step.title}</h2>
        <p id="tn-tour-body" className="tn-tour-body">{step.body}</p>
        <div className="tn-tour-dots" aria-hidden>
          {steps.map((s, i) => <span key={s.id} className={`tn-tour-dot${i === index ? " is-on" : ""}`} />)}
        </div>
        <div className="tn-tour-actions">
          <button type="button" className="tn-tour-btn" onClick={() => go(-1)} disabled={index === 0}>Back</button>
          <button type="button" className="tn-tour-btn is-primary" onClick={() => go(1)}>{last ? "Done" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
