import { expect, test } from "vitest";
import {
  TOUR_STEPS,
  TOUR_VERSION,
  shouldAutoRunTour,
  resolveTourSteps,
  clampStep,
  isLastStep,
  type TourStep,
} from "@/lib/console/tour";

test("the tour has stable, unique step ids and opens + closes with a framing card", () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length); // unique
  expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(5);
  // First + last are target-less framing steps (welcome / done).
  expect(TOUR_STEPS[0].target).toBe("");
  expect(TOUR_STEPS[TOUR_STEPS.length - 1].target).toBe("");
});

test("every targeted step points at a class hook and carries copy", () => {
  for (const s of TOUR_STEPS) {
    expect(s.title.length, `step "${s.id}" needs a title`).toBeGreaterThan(0);
    expect(s.body.length, `step "${s.id}" needs a body`).toBeGreaterThan(0);
    if (s.target !== "") expect(s.target.startsWith("."), `step "${s.id}" target should be a class selector`).toBe(true);
  }
});

test("the tour spotlights the widget ? affordance, the board switcher and ⌘K", () => {
  const targets = new Set(TOUR_STEPS.map((s) => s.target));
  expect(targets.has(".tn-cw-help")).toBe(true);      // the ? help control (deliverable 2)
  expect(targets.has(".tn-preset-pill")).toBe(true);  // board / persona switcher
  expect(targets.has(".tn-palette-trigger")).toBe(true); // ⌘K
});

test("shouldAutoRunTour: fires for a first-ever visitor and after a version bump only", () => {
  expect(shouldAutoRunTour(null)).toBe(true);            // never seen
  expect(shouldAutoRunTour(TOUR_VERSION)).toBe(false);   // seen this version
  expect(shouldAutoRunTour(TOUR_VERSION - 1)).toBe(true); // saw an older tour
  expect(shouldAutoRunTour(TOUR_VERSION + 1)).toBe(false); // ahead somehow → don't nag
});

test("resolveTourSteps drops steps whose target is absent but keeps framing steps", () => {
  const steps: TourStep[] = [
    { id: "welcome", target: "", title: "w", body: "b" },
    { id: "widgets", target: ".tn-cw-col-left", title: "w", body: "b" },
    { id: "palette", target: ".tn-palette-trigger", title: "p", body: "b" },
    { id: "done", target: "", title: "d", body: "b" },
  ];
  // A width where the widget column is hidden — its step is dropped, framing kept.
  const present = new Set([".tn-palette-trigger"]);
  const out = resolveTourSteps(steps, (sel) => present.has(sel));
  expect(out.map((s) => s.id)).toEqual(["welcome", "palette", "done"]);
});

test("resolveTourSteps with no targets present leaves only the framing steps", () => {
  const out = resolveTourSteps(TOUR_STEPS, () => false);
  expect(out.length).toBeGreaterThan(0);
  expect(out.every((s) => s.target === "")).toBe(true);
});

test("clampStep keeps an index inside the run", () => {
  expect(clampStep(-3, 5)).toBe(0);
  expect(clampStep(9, 5)).toBe(4);
  expect(clampStep(2, 5)).toBe(2);
  expect(clampStep(0, 0)).toBe(0); // empty run
});

test("isLastStep flags the final index", () => {
  expect(isLastStep(4, 5)).toBe(true);
  expect(isLastStep(3, 5)).toBe(false);
  expect(isLastStep(0, 0)).toBe(false); // empty run has no last step
});
