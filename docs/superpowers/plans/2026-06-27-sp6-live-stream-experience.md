# SP6 — The Live-Stream Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TrafficNerd's live camera streams visible and visceral — a cinematic globe→down dive that lands on an already-playing, verified-fresh stream, plus live thumbnail markers that show feeds on the map at close zoom.

**Architecture:** A framework-light dive store (`useSyncExternalStore`, mirrors `lib/overlay.ts`) holds a 3-phase lifecycle (`idle→diving→landed`). A pure `computeDive()` derives the MapLibre camera params; WorldMap registers an imperative `diveTo` bridge on `mapViewStore` (sibling to the existing `flyToPoint`). `CinematicDive` orchestrates: kicks the fly, **pre-warms** the stream (mounts `CameraDetail` hidden during the dive so HLS is buffered by landing), then materializes the hero card. A ⌘K "Dive to a live feed" command guarantees the wow on a known-live camera. Live thumbnail markers are a capped `maplibregl.Marker` pool managed by `lib/map/liveThumbnails.ts`, wired to `moveend`/`zoomend` in WorldMap.

**Tech Stack:** Next.js 15.5 / React 19 / TypeScript, MapLibre GL (`projection: globe`), hls.js, vitest (node env).

## Global Constraints

- **Commits are SOLO-attributed.** NO `Co-Authored-By`, NO "Generated with Claude" trailer. Use `git -c commit.gpgsign=false commit -m "..."`. Add only the exact files each step names — NEVER `git add -A`.
- **Branch:** `feat/sp6-cinematic-dive` in worktree `C:/Users/sampo/Desktop/tn-sp6`. Never touch `main` directly.
- **Tests are vitest, NODE env, NO jsdom / no @testing-library.** Unit-test pure logic + stores only. Components are verified via `tsc` + `npm run build` + Playwright. Test files live in `tests/unit/*.test.ts`.
- **Run a single test file:** `npx vitest run tests/unit/<file>.test.ts`. Full suite: `npx vitest run`.
- **tsc gate:** `npx tsc --noEmit` must be 0 errors. IGNORE any error whose path contains `.claude/worktrees` (stale parallel worktrees) — filter with `npx tsc --noEmit 2>&1 | grep -v worktrees`.
- **NEVER run `next dev` and `npm run build` concurrently** (corrupts `.next`).
- **Scope: traffic cameras ONLY.** Webcams / planes / satellites / signals keep the existing instant `overlay.open` dossier. Do NOT change their click handlers.
- **Import alias:** `@/` = repo root (e.g. `@/lib/cinematic/store`).
- **Honesty:** the landing badge must state the truth (LIVE vs still-with-countdown vs offline) — never present a still frame as moving video.
- **Reduced motion:** `prefers-reduced-motion: reduce` must skip the fly animation (jump + instant land) and disable card transitions.

---

### Task 1: Pure dive-camera math (`computeDive`)

**Files:**
- Create: `lib/cinematic/dive.ts`
- Test: `tests/unit/cinematic-dive.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface DiveTarget { lat: number; lon: number }`
  - `interface DiveCameraParams { center: [number, number]; zoom: number; pitch: number; bearing: number; duration: number }`
  - `function computeDive(target: DiveTarget): DiveCameraParams`
  - consts `DIVE_ZOOM = 14.5`, `DIVE_PITCH = 50`, `DIVE_DURATION = 1500`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/cinematic-dive.test.ts
import { describe, it, expect } from "vitest";
import { computeDive, DIVE_DURATION } from "@/lib/cinematic/dive";

describe("computeDive", () => {
  it("centers on the target as [lon, lat]", () => {
    const p = computeDive({ lat: 51.5, lon: -0.12 });
    expect(p.center).toEqual([-0.12, 51.5]);
  });
  it("clamps zoom into the street range [12, 16]", () => {
    const p = computeDive({ lat: 0, lon: 0 });
    expect(p.zoom).toBeGreaterThanOrEqual(12);
    expect(p.zoom).toBeLessThanOrEqual(16);
  });
  it("keeps pitch within [0, 60] and bearing 0", () => {
    const p = computeDive({ lat: 0, lon: 0 });
    expect(p.pitch).toBeGreaterThanOrEqual(0);
    expect(p.pitch).toBeLessThanOrEqual(60);
    expect(p.bearing).toBe(0);
  });
  it("clamps latitude to the web-mercator-safe ±85", () => {
    expect(computeDive({ lat: 89, lon: 0 }).center[1]).toBeCloseTo(85);
    expect(computeDive({ lat: -89, lon: 0 }).center[1]).toBeCloseTo(-85);
  });
  it("wraps longitude into [-180, 180)", () => {
    expect(computeDive({ lat: 0, lon: 200 }).center[0]).toBeCloseTo(-160);
  });
  it("uses the standard dive duration", () => {
    expect(computeDive({ lat: 0, lon: 0 }).duration).toBe(DIVE_DURATION);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cinematic-dive.test.ts`
Expected: FAIL (`Cannot find module '@/lib/cinematic/dive'`).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/cinematic/dive.ts
// Pure camera math for the cinematic dive (SP6). No MapLibre import — so it is
// node-testable. WorldMap.diveTo feeds the result straight into map.flyTo/jumpTo.

export interface DiveTarget {
  lat: number;
  lon: number;
}

export interface DiveCameraParams {
  /** MapLibre order: [lon, lat]. */
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  /** flyTo animation length, ms. */
  duration: number;
}

/** Street-level landing zoom — close enough to read a single junction. */
export const DIVE_ZOOM = 14.5;
/** Cinematic tilt on arrival. */
export const DIVE_PITCH = 50;
/** Fly animation length, ms. Long enough to feel like a dive, short enough to skip past. */
export const DIVE_DURATION = 1500;

const MIN_ZOOM = 12;
const MAX_ZOOM = 16;
const MAX_PITCH = 60;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Normalise longitude into [-180, 180). */
function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function computeDive(target: DiveTarget): DiveCameraParams {
  const lat = clamp(target.lat, -85, 85);
  const lon = wrapLon(target.lon);
  return {
    center: [lon, lat],
    zoom: clamp(DIVE_ZOOM, MIN_ZOOM, MAX_ZOOM),
    pitch: clamp(DIVE_PITCH, 0, MAX_PITCH),
    bearing: 0,
    duration: DIVE_DURATION,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cinematic-dive.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cinematic/dive.ts tests/unit/cinematic-dive.test.ts
git -c commit.gpgsign=false commit -m "feat(sp6): pure computeDive camera math"
```

---

### Task 2: Dive lifecycle store

**Files:**
- Create: `lib/cinematic/store.ts`
- Test: `tests/unit/cinematic-store.test.ts`

**Interfaces:**
- Consumes: `WorldObject` from `@/lib/world`.
- Produces:
  - `type DivePhase = "idle" | "diving" | "landed"`
  - `interface DiveState { phase: DivePhase; target: WorldObject | null }`
  - `const cinematic` with `dive(target: WorldObject)`, `land()`, `close()`, `get(): DiveState`, `subscribe(l: () => void): () => void`
  - `function useDive(): DiveState`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/cinematic-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { cinematic } from "@/lib/cinematic/store";
import type { WorldObject } from "@/lib/world";

const cam = (id: string): WorldObject => ({
  kind: "camera", id, lat: 51.5, lon: -0.12, label: `Cam ${id}`,
});

describe("cinematic dive store", () => {
  beforeEach(() => cinematic.close());

  it("starts idle with no target", () => {
    expect(cinematic.get()).toEqual({ phase: "idle", target: null });
  });

  it("dive() enters the diving phase carrying the target", () => {
    cinematic.dive(cam("a"));
    expect(cinematic.get().phase).toBe("diving");
    expect(cinematic.get().target?.id).toBe("a");
  });

  it("land() promotes diving → landed, keeping the target", () => {
    cinematic.dive(cam("a"));
    cinematic.land();
    expect(cinematic.get().phase).toBe("landed");
    expect(cinematic.get().target?.id).toBe("a");
  });

  it("land() is a no-op when not diving", () => {
    cinematic.land();
    expect(cinematic.get().phase).toBe("idle");
  });

  it("diving to a new target while landed re-dives", () => {
    cinematic.dive(cam("a"));
    cinematic.land();
    cinematic.dive(cam("b"));
    expect(cinematic.get().phase).toBe("diving");
    expect(cinematic.get().target?.id).toBe("b");
  });

  it("close() resets to idle/null and notifies subscribers", () => {
    let hits = 0;
    const unsub = cinematic.subscribe(() => { hits += 1; });
    cinematic.dive(cam("a"));
    cinematic.close();
    expect(cinematic.get()).toEqual({ phase: "idle", target: null });
    expect(hits).toBeGreaterThanOrEqual(2);
    unsub();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cinematic-store.test.ts`
Expected: FAIL (`Cannot find module '@/lib/cinematic/store'`).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/cinematic/store.ts
"use client";
// The cinematic-dive store (SP6). Mirrors lib/overlay.ts: a tiny external store +
// useSyncExternalStore, no new dependency. Camera clicks call cinematic.dive(obj);
// <CinematicDive> drives the fly + pre-warm and calls land() on arrival; close()
// dismisses the hero card (revealing the live street-level map underneath).
//
// Three phases, deliberately: idle (no dive), diving (flying + pre-warming the
// hidden feed), landed (hero card materialised, stream playing). There is no
// "fly back out" on close — the user stays put on the live map (YAGNI; avoids a
// disorienting second animation).

import { useSyncExternalStore } from "react";
import type { WorldObject } from "@/lib/world";

export type DivePhase = "idle" | "diving" | "landed";

export interface DiveState {
  phase: DivePhase;
  target: WorldObject | null;
}

let state: DiveState = { phase: "idle", target: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const cinematic = {
  /** Begin a dive to `target` (or re-target if one is in progress / landed). */
  dive(target: WorldObject) {
    state = { phase: "diving", target };
    emit();
  },
  /** Arrival: promote the in-flight dive to a landed hero card. No-op otherwise. */
  land() {
    if (state.phase !== "diving") return;
    state = { ...state, phase: "landed" };
    emit();
  },
  /** Dismiss the hero card and reset. */
  close() {
    if (state.phase === "idle" && state.target === null) return;
    state = { phase: "idle", target: null };
    emit();
  },
  get(): DiveState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** React hook: re-renders the caller on any dive-phase change. */
export function useDive(): DiveState {
  return useSyncExternalStore(cinematic.subscribe, cinematic.get, cinematic.get);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cinematic-store.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cinematic/store.ts tests/unit/cinematic-store.test.ts
git -c commit.gpgsign=false commit -m "feat(sp6): dive lifecycle store (idle/diving/landed)"
```

---

### Task 3: Pure live-camera picker (`pickLiveCamera`)

**Files:**
- Create: `lib/cinematic/livePick.ts`
- Test: `tests/unit/cinematic-livepick.test.ts`

**Interfaces:**
- Consumes: nothing (structural generic).
- Produces: `function pickLiveCamera<T extends { available: boolean; live: boolean }>(cams: readonly T[]): T | null`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/cinematic-livepick.test.ts
import { describe, it, expect } from "vitest";
import { pickLiveCamera } from "@/lib/cinematic/livePick";

const c = (id: string, available: boolean, live: boolean) => ({ id, available, live });

describe("pickLiveCamera", () => {
  it("returns the first available && live camera in input order", () => {
    const cams = [c("a", true, false), c("b", false, true), c("c", true, true), c("d", true, true)];
    expect(pickLiveCamera(cams)?.id).toBe("c");
  });
  it("returns null when none are live", () => {
    expect(pickLiveCamera([c("a", true, false), c("b", false, true)])).toBeNull();
  });
  it("returns null for an empty list", () => {
    expect(pickLiveCamera([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cinematic-livepick.test.ts`
Expected: FAIL (`Cannot find module '@/lib/cinematic/livePick'`).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/cinematic/livePick.ts
// Pick a currently-live camera for the ⌘K "Dive to a live feed" showcase (SP6).
// Deterministic — first available && live in input order, so it is unit-testable
// and the showcase is reproducible. Generic so it works on the loaded-camera
// store records without importing them.

export function pickLiveCamera<T extends { available: boolean; live: boolean }>(
  cams: readonly T[],
): T | null {
  for (const cam of cams) {
    if (cam.available && cam.live) return cam;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cinematic-livepick.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cinematic/livePick.ts tests/unit/cinematic-livepick.test.ts
git -c commit.gpgsign=false commit -m "feat(sp6): pure pickLiveCamera selector"
```

---

### Task 4: `diveTo` map bridge + camera click → dive

**Files:**
- Modify: `lib/mapView.ts` (add `DiveView`, `registerDiveTo`, `diveTo`)
- Modify: `components/WorldMap.tsx` (import `computeDive` + `cinematic`; register a `diveTo` handler; change the camera click)
- Test: `tests/unit/mapview-dive.test.ts`

**Interfaces:**
- Consumes: `computeDive`, `DiveTarget` (Task 1); `cinematic` (Task 2).
- Produces on `mapViewStore`:
  - `interface DiveView { lat: number; lon: number }`
  - `registerDiveTo(fn: ((view: DiveView, animate: boolean, onArrive: () => void) => void) | null): void`
  - `diveTo(view: DiveView, animate: boolean, onArrive: () => void): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/mapview-dive.test.ts
import { describe, it, expect } from "vitest";
import { mapViewStore } from "@/lib/mapView";

describe("mapViewStore dive bridge", () => {
  it("diveTo is a no-op (no throw) when no handler is registered", () => {
    mapViewStore.registerDiveTo(null);
    expect(() => mapViewStore.diveTo({ lat: 1, lon: 2 }, true, () => {})).not.toThrow();
  });

  it("forwards view, animate flag and onArrive to the registered handler", () => {
    const calls: Array<{ lat: number; lon: number; animate: boolean }> = [];
    let arrived = false;
    mapViewStore.registerDiveTo((view, animate, onArrive) => {
      calls.push({ lat: view.lat, lon: view.lon, animate });
      onArrive();
    });
    mapViewStore.diveTo({ lat: 51.5, lon: -0.12 }, false, () => { arrived = true; });
    expect(calls).toEqual([{ lat: 51.5, lon: -0.12, animate: false }]);
    expect(arrived).toBe(true);
    mapViewStore.registerDiveTo(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/mapview-dive.test.ts`
Expected: FAIL (`mapViewStore.registerDiveTo is not a function`).

- [ ] **Step 3: Add the dive bridge to `lib/mapView.ts`**

Add the `DiveView` interface after the `PointView` interface (after line 32):

```ts
/**
 * A cinematic-dive target (SP6). WorldMap turns this into a pitched flyTo via
 * computeDive; `animate=false` (reduced motion) jumps instead. `onArrive` fires
 * when the camera settles, so the dive store can promote diving → landed.
 */
export interface DiveView {
  lat: number;
  lon: number;
}
```

Add the module-level handler ref next to `flyToPointFn` (after line 41):

```ts
let diveToFn: ((view: DiveView, animate: boolean, onArrive: () => void) => void) | null = null;
```

Add the two methods to the `mapViewStore` object, just before the closing `};` (after the `flyToPoint` method, line 81):

```ts
  /** WorldMap registers its cinematic-dive handler here on mount (SP6). */
  registerDiveTo(fn: ((view: DiveView, animate: boolean, onArrive: () => void) => void) | null) {
    diveToFn = fn;
  },
  diveTo(view: DiveView, animate: boolean, onArrive: () => void) {
    if (diveToFn) diveToFn(view, animate, onArrive);
    else onArrive(); // no map yet → land immediately so the store never hangs
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/mapview-dive.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the `diveTo` handler in `components/WorldMap.tsx`**

Add imports near the top (after line 18 `import { overlay } from "@/lib/overlay";`):

```ts
import { cinematic } from "@/lib/cinematic/store";
import { computeDive } from "@/lib/cinematic/dive";
```

Add to the `mapViewStore` import on line 25 so it also brings `DiveView`:

```ts
import { mapViewStore, useMapView, type RegionView, type PointView, type DiveView } from "@/lib/mapView";
```

Immediately after the `flyToPoint` registration effect (after line 955 `}, [flyToPoint]);`), add the dive handler + its registration:

```ts
  // Cinematic dive (SP6): a pitched flyTo to a single camera; on arrival, promote
  // the dive store to "landed" so <CinematicDive> materialises the hero feed.
  // animate=false (reduced motion) jumps instantly and lands at once.
  const diveTo = useCallback((view: DiveView, animate: boolean, onArrive: () => void) => {
    const map = mapRef.current;
    if (!map) { onArrive(); return; }
    const p = computeDive({ lat: view.lat, lon: view.lon });
    // Suppress the idle spin through the dive (+ a little slack).
    interactUntilRef.current = performance.now() + p.duration + 600;
    if (!animate) {
      map.jumpTo({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing });
      onArrive();
      return;
    }
    map.once("moveend", onArrive);
    map.flyTo({
      center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing,
      duration: p.duration, essential: true,
    });
  }, []);

  useEffect(() => {
    mapViewStore.registerDiveTo(diveTo);
    return () => mapViewStore.registerDiveTo(null);
  }, [diveTo]);
```

- [ ] **Step 6: Change the camera click from `overlay.open` to `cinematic.dive`**

In `wireInteractions`, replace the `camClick` body (lines 664-677, the `overlay.open({ kind: "camera", ... })` call) so it dives instead:

```ts
    const camClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const p = f.properties as { id: string; name: string; available: boolean | string };
      cinematic.dive({
        kind: "camera",
        id: p.id,
        lat,
        lon,
        label: p.name,
        meta: { available: p.available === true || p.available === "true" },
      });
    };
```

(Leave the plane / satellite / webcam / signal click handlers calling `overlay.open` UNCHANGED — scope is cameras only. The deep-link `pendingObjRef` path that opens a camera via `overlay.open` also stays as-is — it still renders `CameraDetail` in the dossier as a functional fallback.)

- [ ] **Step 7: Verify tsc + build**

Run: `npx tsc --noEmit 2>&1 | grep -v worktrees`
Expected: no output (0 errors).
Run: `npx vitest run tests/unit/mapview-dive.test.ts tests/unit/cinematic-store.test.ts tests/unit/cinematic-dive.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add lib/mapView.ts components/WorldMap.tsx tests/unit/mapview-dive.test.ts
git -c commit.gpgsign=false commit -m "feat(sp6): diveTo map bridge + camera click triggers the dive"
```

---

### Task 5: `CinematicDive` orchestrator + hero card (THE dive ships here)

**Files:**
- Create: `components/CinematicDive.tsx`
- Modify: `components/shell/ConsoleShell.tsx` (mount `<CinematicDive />`)
- Modify: `app/globals.css` (append the `.tn-dive*` styles)

**Interfaces:**
- Consumes: `cinematic`, `useDive` (Task 2); `mapViewStore.diveTo` (Task 4); `CameraDetail` from `@/components/CameraDetail`.
- Produces: `function CinematicDive()` (default-free named export), mounted once in `ConsoleShell`.

**Behaviour:** When `phase==="diving"` for a new target, call `mapViewStore.diveTo({lat,lon}, animate, () => cinematic.land())` once (animate = not reduced-motion). Render the hero card whenever `phase !== "idle"` and `target.kind === "camera"`: `CameraDetail` is mounted during BOTH diving and landed (so HLS pre-warms behind a curtain), the card is visually hidden (opacity, NOT display) while diving, and materialises on land. Esc / the × button call `cinematic.close()`.

- [ ] **Step 1: Create the component**

```tsx
// components/CinematicDive.tsx
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
```

- [ ] **Step 2: Mount it in `ConsoleShell`**

In `components/shell/ConsoleShell.tsx`, add the import alongside the other component imports (after line 23 `import { FeedOverlay } from "@/components/FeedOverlay";`):

```tsx
import { CinematicDive } from "@/components/CinematicDive";
```

Add `<CinematicDive />` immediately after `<FeedOverlay />` (line 70):

```tsx
      <FeedOverlay />
      <CinematicDive />
```

- [ ] **Step 3: Append the styles to `app/globals.css`**

Append at the END of `app/globals.css`:

```css
/* SP6 — cinematic dive hero card -------------------------------------------- */
.tn-dive {
  position: fixed;
  inset: 0;
  z-index: 39; /* above the map + dossier slide-ins, below the topbar (40+) */
  display: grid;
  place-items: center;
  padding: clamp(12px, 4vw, 48px);
  pointer-events: none; /* during the dive, let the globe fly untouched */
}
.tn-dive-landed {
  pointer-events: auto;
  background: rgba(15, 23, 42, 0.28); /* gentle scrim once we land */
}
.tn-dive-card {
  position: relative;
  width: min(760px, 92vw);
  max-height: 86vh;
  overflow: auto;
  background: var(--tn-surface, #ffffff);
  border: 1px solid var(--tn-border, #d6dee6);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
  padding: 18px 18px 14px;
  /* Materialise on landing. */
  opacity: 0;
  transform: scale(0.965) translateY(8px);
  transition: opacity 280ms ease, transform 280ms ease;
}
.tn-dive-landed .tn-dive-card {
  opacity: 1;
  transform: none;
}
/* While diving the card is mounted (pre-warming the feed) but invisible — opacity,
   NOT display:none, so the <video>/<img> actually loads. */
.tn-dive-diving .tn-dive-card {
  opacity: 0;
  pointer-events: none;
}
.tn-dive-close {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: var(--tn-surface-2, #f1f5f9);
  color: var(--tn-text, #0f172a);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.tn-dive-close:hover { background: var(--tn-border, #d6dee6); }
.tn-dive-curtain {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 8px;
  grid-auto-flow: row;
}
.tn-dive-spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 3px solid var(--tn-border, #d6dee6);
  border-top-color: var(--tn-accent, #0ea5e9);
  animation: tn-dive-spin 0.8s linear infinite;
}
.tn-dive-curtain-label {
  font-size: 13px;
  color: var(--tn-text-dim, #64748b);
}
@keyframes tn-dive-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .tn-dive-card { transition: none; transform: none; }
  .tn-dive-spinner { animation: none; }
}
```

(Note: `--tn-surface-2`, `--tn-text-dim` are used elsewhere in the file with fallbacks; the `var(..., fallback)` form keeps this safe even if a token is absent.)

- [ ] **Step 4: Verify tsc + build**

Run: `npx tsc --noEmit 2>&1 | grep -v worktrees`
Expected: no output.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Runtime verification (Playwright)**

Build then `npx next start -p 3100` in the background. With Playwright (or chrome-devtools MCP): load `http://localhost:3100`, zoom in until camera icons show, click a camera. Confirm: the map flies/pitches, then a centered card materialises containing a `<video>` (live) or refreshing `<img>` (still) with a status line; pressing Esc closes it; console has 0 errors. Stop the server when done (do NOT leave it running alongside a later `npm run build`). Save any screenshot into `docs/superpowers/research/`.

- [ ] **Step 6: Commit**

```bash
git add components/CinematicDive.tsx components/shell/ConsoleShell.tsx app/globals.css
git -c commit.gpgsign=false commit -m "feat(sp6): cinematic dive orchestrator + hero card (pre-warmed, reduced-motion aware)"
```

---

### Task 6: ⌘K "Dive to a live feed" showcase

**Files:**
- Create: `lib/cameras/loaded.ts` (lightweight loaded-camera store)
- Modify: `components/WorldMap.tsx` (publish the loaded cameras)
- Modify: `components/shell/CommandPalette.tsx` (add the command)
- Test: `tests/unit/cameras-loaded.test.ts`

**Interfaces:**
- Consumes: `pickLiveCamera` (Task 3); `cinematic` (Task 2).
- Produces:
  - `interface LoadedCamera { id: string; name: string; lat: number; lon: number; available: boolean; live: boolean }`
  - `const loadedCamerasStore` with `set(cams: LoadedCamera[]): void`, `get(): LoadedCamera[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/cameras-loaded.test.ts
import { describe, it, expect } from "vitest";
import { loadedCamerasStore } from "@/lib/cameras/loaded";

describe("loadedCamerasStore", () => {
  it("starts empty", () => {
    loadedCamerasStore.set([]);
    expect(loadedCamerasStore.get()).toEqual([]);
  });
  it("stores and returns the latest set", () => {
    const cams = [{ id: "a", name: "A", lat: 1, lon: 2, available: true, live: true }];
    loadedCamerasStore.set(cams);
    expect(loadedCamerasStore.get()).toHaveLength(1);
    expect(loadedCamerasStore.get()[0].id).toBe("a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cameras-loaded.test.ts`
Expected: FAIL (`Cannot find module '@/lib/cameras/loaded'`).

- [ ] **Step 3: Create the store**

```ts
// lib/cameras/loaded.ts
"use client";
// A lightweight snapshot of the cameras currently loaded on the map, so the ⌘K
// "Dive to a live feed" command can pick a known-live one without re-fetching the
// full /api/cameras payload. WorldMap publishes here whenever CamerasFeed lands.
// Not reactive on purpose — the command reads it on demand.

export interface LoadedCamera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  available: boolean;
  live: boolean;
}

let cams: LoadedCamera[] = [];

export const loadedCamerasStore = {
  set(next: LoadedCamera[]) {
    cams = next;
  },
  get(): LoadedCamera[] {
    return cams;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cameras-loaded.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Publish loaded cameras from `CamerasFeed`**

In `components/WorldMap.tsx`, add the import near the others (after the `cinematic`/`computeDive` imports added in Task 4):

```ts
import { loadedCamerasStore } from "@/lib/cameras/loaded";
```

In the `CamerasFeed` component's success handler (around line 1057-1061), publish the snapshot right after `onData(cams)`. The `Pt` type already carries `{id,name,lat,lon,available,live}`, which is structurally a `LoadedCamera`:

```ts
        const cams = (d.cameras as Pt[]) ?? [];
        onData(cams);
        loadedCamerasStore.set(cams);
        freshnessStore.record("cameras", { count: cams.length, ok: true });
```

- [ ] **Step 6: Add the command to `CommandPalette.tsx`**

Add imports (after line 13 `import { CAMERA_REGIONS } from "@/lib/icons/svg";`):

```ts
import { cinematic } from "@/lib/cinematic/store";
import { pickLiveCamera } from "@/lib/cinematic/livePick";
import { loadedCamerasStore } from "@/lib/cameras/loaded";
```

Add the command inside `buildCommands`, right before `return cmds;` (after the `toggle-workspace` push, line 114):

```ts
  cmds.push({
    id: "dive-live",
    label: "Dive to a live feed",
    hint: "live",
    run: () => {
      const cam = pickLiveCamera(loadedCamerasStore.get());
      if (cam) {
        cinematic.dive({
          kind: "camera",
          id: cam.id,
          lat: cam.lat,
          lon: cam.lon,
          label: cam.name,
          meta: { available: true },
        });
      }
      close();
    },
  });
```

(If no camera is live yet, the command simply closes — no crash. This is the deterministic showcase entry that guarantees the dive lands on a moving image when one exists.)

- [ ] **Step 7: Verify tsc + build + tests**

Run: `npx tsc --noEmit 2>&1 | grep -v worktrees`
Expected: no output.
Run: `npx vitest run tests/unit/cameras-loaded.test.ts tests/unit/cinematic-livepick.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add lib/cameras/loaded.ts components/WorldMap.tsx components/shell/CommandPalette.tsx tests/unit/cameras-loaded.test.ts
git -c commit.gpgsign=false commit -m "feat(sp6): ⌘K 'Dive to a live feed' showcase + loaded-camera store"
```

---

### Task 7: Live thumbnail markers at close zoom

**Files:**
- Create: `lib/map/liveThumbnails.ts` (pure `selectThumbnails` + the side-effecting marker manager)
- Modify: `components/WorldMap.tsx` (create + drive the manager on `moveend`/`zoomend`)
- Modify: `app/globals.css` (append the `.tn-thumb*` styles)
- Test: `tests/unit/live-thumbnails.test.ts`

**Interfaces:**
- Consumes: `maplibregl` (already imported in WorldMap); the `CAM_LAYER` id; `cinematic` (Task 2).
- Produces:
  - `interface ThumbCandidate { id: string; lon: number; lat: number; name: string }`
  - `function selectThumbnails(candidates: ThumbCandidate[], max: number): ThumbCandidate[]`
  - consts `THUMB_MIN_ZOOM = 12`, `MAX_THUMBS = 24`
  - `function createThumbnailManager(deps: ThumbDeps): { update(): void; destroy(): void }` where
    `interface ThumbDeps { map: maplibregl.Map; layerId: string; onPick: (c: ThumbCandidate) => void }`

- [ ] **Step 1: Write the failing test (pure selector only)**

```ts
// tests/unit/live-thumbnails.test.ts
import { describe, it, expect } from "vitest";
import { selectThumbnails } from "@/lib/map/liveThumbnails";

const t = (id: string) => ({ id, lon: 0, lat: 0, name: id });

describe("selectThumbnails", () => {
  it("de-dupes by id, keeping first occurrence", () => {
    const out = selectThumbnails([t("a"), t("a"), t("b")], 10);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("caps the result at max in input order", () => {
    const out = selectThumbnails([t("a"), t("b"), t("c"), t("d")], 2);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("returns [] for empty input", () => {
    expect(selectThumbnails([], 5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/live-thumbnails.test.ts`
Expected: FAIL (`Cannot find module '@/lib/map/liveThumbnails'`).

- [ ] **Step 3: Implement the selector + marker manager**

```ts
// lib/map/liveThumbnails.ts
"use client";
// SP6 — live thumbnail markers. Above THUMB_MIN_ZOOM, a small capped pool of HTML
// markers shows the live still poster for in-viewport cameras, so streams are
// visible at a glance (not buried behind a click). The pure selectThumbnails is
// node-tested; the manager is the side-effecting maplibregl.Marker pool, verified
// via the browser. queryRenderedFeatures already restricts to the visible viewport
// and returns [] if the layer is absent, so this is safe before layers load.

import maplibregl from "maplibre-gl";

export interface ThumbCandidate {
  id: string;
  lon: number;
  lat: number;
  name: string;
}

/** Below this zoom, no thumbnails (would be dot-soup / wasted image loads). */
export const THUMB_MIN_ZOOM = 12;
/** Hard cap on simultaneous thumbnail markers (perf guard). */
export const MAX_THUMBS = 24;

/** De-dupe by id (first wins) and cap at `max`, preserving input order. */
export function selectThumbnails(candidates: ThumbCandidate[], max: number): ThumbCandidate[] {
  const seen = new Set<string>();
  const out: ThumbCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

export interface ThumbDeps {
  map: maplibregl.Map;
  layerId: string;
  onPick: (c: ThumbCandidate) => void;
}

export function createThumbnailManager(deps: ThumbDeps): { update(): void; destroy(): void } {
  const { map, layerId, onPick } = deps;
  const markers = new Map<string, maplibregl.Marker>();

  const buildEl = (c: ThumbCandidate): HTMLElement => {
    const el = document.createElement("button");
    el.className = "tn-thumb";
    el.type = "button";
    el.setAttribute("aria-label", `Live feed: ${c.name}`);
    const img = document.createElement("img");
    img.className = "tn-thumb-img";
    img.loading = "lazy";
    img.alt = "";
    img.src = `/api/proxy?id=${encodeURIComponent(c.id)}`;
    img.addEventListener("error", () => { el.classList.add("tn-thumb-failed"); });
    el.appendChild(img);
    el.addEventListener("click", (ev) => { ev.stopPropagation(); onPick(c); });
    return el;
  };

  const clear = () => {
    for (const m of markers.values()) m.remove();
    markers.clear();
  };

  const update = () => {
    if (!map.getLayer(layerId) || map.getZoom() < THUMB_MIN_ZOOM) {
      if (markers.size) clear();
      return;
    }
    let raw: maplibregl.MapGeoJSONFeature[] = [];
    try {
      raw = map.queryRenderedFeatures({ layers: [layerId] });
    } catch {
      raw = [];
    }
    const candidates: ThumbCandidate[] = [];
    for (const f of raw) {
      if (f.geometry.type !== "Point") continue;
      const props = f.properties as { id?: string; name?: string; available?: boolean | string } | null;
      if (!props?.id) continue;
      // `available` (a working feed) is what toCameraFC emits; the /api/proxy
      // poster works for both live-video and still cameras, so any available
      // camera gets a thumbnail — the goal is to SEE the feeds at a glance.
      const available = props.available === true || props.available === "true";
      if (!available) continue;
      const [lon, lat] = f.geometry.coordinates as [number, number];
      candidates.push({ id: props.id, lon, lat, name: props.name ?? "Camera" });
    }
    const wanted = selectThumbnails(candidates, MAX_THUMBS);
    const wantedIds = new Set(wanted.map((c) => c.id));
    for (const [id, m] of markers) {
      if (!wantedIds.has(id)) { m.remove(); markers.delete(id); }
    }
    for (const c of wanted) {
      if (markers.has(c.id)) continue;
      const m = new maplibregl.Marker({ element: buildEl(c), anchor: "bottom" })
        .setLngLat([c.lon, c.lat])
        .addTo(map);
      markers.set(c.id, m);
    }
  };

  const destroy = () => clear();
  return { update, destroy };
}
```

NOTE for the implementer: this uses ONLY the `id` / `name` / `available` props that `toCameraFC` (`lib/map/features.ts`) already emits on `CAM_LAYER` features — no change to `toCameraFC` is required. Do NOT add a `live` prop.

- [ ] **Step 4: Run the pure test to verify it passes**

Run: `npx vitest run tests/unit/live-thumbnails.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Drive the manager from `WorldMap.tsx`**

Add the import near the other `lib/map` imports (after line 31 `import { CAMERA_CLUSTER, ... } from "@/lib/map/cluster";`):

```ts
import { createThumbnailManager } from "@/lib/map/liveThumbnails";
```

Add a ref next to the other refs (near `mapRef`):

```ts
  const thumbMgrRef = useRef<{ update(): void; destroy(): void } | null>(null);
```

In the main map-init effect, AFTER `wireInteractions(map)` (line 773), create the manager and drive it on view changes:

```ts
    const thumbMgr = createThumbnailManager({
      map,
      layerId: CAM_LAYER,
      onPick: (c) =>
        cinematic.dive({ kind: "camera", id: c.id, lat: c.lat, lon: c.lon, label: c.name, meta: { available: true } }),
    });
    thumbMgrRef.current = thumbMgr;
    const onThumbRefresh = () => thumbMgr.update();
    map.on("moveend", onThumbRefresh);
    map.on("zoomend", onThumbRefresh);
    map.on("data", onThumbRefresh); // re-evaluate when the camera source finishes loading
```

In that effect's cleanup (the `return () => { ... }` around line 826-832, where `map.remove()` is called), tear it down BEFORE `map.remove()`:

```ts
      map.off("moveend", onThumbRefresh);
      map.off("zoomend", onThumbRefresh);
      map.off("data", onThumbRefresh);
      thumbMgr.destroy();
      thumbMgrRef.current = null;
```

- [ ] **Step 6: Append the thumbnail styles to `app/globals.css`**

Append at the END of `app/globals.css`:

```css
/* SP6 — live thumbnail markers ---------------------------------------------- */
.tn-thumb {
  display: block;
  width: 64px;
  height: 44px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 8px;
  overflow: hidden;
  background: var(--tn-surface-2, #f1f5f9);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.28);
  cursor: pointer;
  transition: transform 120ms ease;
}
.tn-thumb:hover { transform: scale(1.08); }
.tn-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.tn-thumb-failed { display: none; }
@media (prefers-reduced-motion: reduce) {
  .tn-thumb { transition: none; }
}
```

- [ ] **Step 7: Verify tsc + build**

Run: `npx tsc --noEmit 2>&1 | grep -v worktrees`
Expected: no output.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Runtime verification (Playwright)**

`npx next start -p 3100` (background). Load the app, zoom past zoom 12 over a dense camera region (e.g. London / California). Confirm small live poster thumbnails appear over cameras (≤ 24), clicking one triggers the dive, and zooming back out below 12 removes them. Console 0 errors. Stop the server after. Save a screenshot to `docs/superpowers/research/`.

- [ ] **Step 9: Commit**

```bash
git add lib/map/liveThumbnails.ts components/WorldMap.tsx app/globals.css tests/unit/live-thumbnails.test.ts
git -c commit.gpgsign=false commit -m "feat(sp6): live thumbnail markers at close zoom"
```

---

## Final gate (after all tasks)

- [ ] `npx tsc --noEmit 2>&1 | grep -v worktrees` → no output.
- [ ] `npx vitest run` → all green (baseline 374 + new: cinematic-dive 6, cinematic-store 6, cinematic-livepick 3, mapview-dive 2, cameras-loaded 2, live-thumbnails 3 = **~396**).
- [ ] `npm run build` → succeeds.
- [ ] Runtime smoke: click a camera → dive lands on a playing/refreshing feed with an honest status; ⌘K "Dive to a live feed" works; thumbnails appear past zoom 12; Esc closes; reduced-motion opens instantly; console 0 errors.
- [ ] Update memory file `trafficnerd.md` + `MEMORY.md` pointer with SP6 status.
- [ ] Then invoke superpowers:finishing-a-development-branch.

## Spec coverage check

- Cinematic dive (globe→down, lands on playing stream) → Tasks 1,2,4,5. ✓
- Pre-warm so video plays on landing → Task 5 (CameraDetail mounted during diving). ✓
- Freshness verification on landing → reuses `CameraDetail`'s existing live/still/offline + countdown (Task 5). ✓
- ⌘K "Dive to a live feed" showcase → Task 6. ✓
- Live thumbnail markers at close zoom → Task 7. ✓
- Reduced-motion fallback → Task 5 (animate flag) + Task 4 (jumpTo). ✓
- Fallbacks (still / offline) → inherited from `CameraDetail` (Task 5). ✓
- Scope cameras-only (others keep overlay) → Task 4 step 6 leaves other handlers. ✓
- Unit tests pure logic; components via build+Playwright → every task. ✓

## Deviations from the spec (intentional)

- **No "fly back out" on close.** The spec sketched a `leaving` phase; dropped as YAGNI. Closing the hero card leaves the user on the live street-level map (manual zoom-out), avoiding a second disorienting animation. Store is 3-phase, not 4.
- **`LiveThumbnailLayer.tsx` → `lib/map/liveThumbnails.ts`.** The spec allowed "a marker manager inside WorldMap"; a `lib/map` module matches the existing `cluster.ts`/`icons.ts`/`features.ts` pattern and keeps WorldMap thinner, with the pure selector node-testable.
