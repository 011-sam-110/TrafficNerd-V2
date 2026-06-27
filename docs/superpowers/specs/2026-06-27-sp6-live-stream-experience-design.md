# SP6 — The Live-Stream Experience (Design Spec)

**Date:** 2026-06-27
**Branch:** `feat/sp6-cinematic-dive`
**Status:** design — approved to build (autonomous track)

## Goal

Make TrafficNerd's live camera streams the visible, visceral centre of the
product. Two cohesive deliverables, same theme ("actually see the streams"):

1. **Cinematic dive** — clicking a camera flies the globe *down* to it and lands
   on an **already-playing, verified-fresh** stream. The differentiation "wow":
   *seamless globe→live-video zoom ending on a verified-fresh moving image.*
2. **Live thumbnail markers** — at close zoom, in-viewport cameras render as small
   live poster thumbnails directly on the map, so streams are visible **at a
   glance**, not buried behind a click.

## Why

- **User feedback (verbatim):** *"I would like to actually be able to see streams
  on there/data."*
- **Independent viz review finding:** all real data (live video, magnitudes,
  scores) lives behind a click; the map surface shows only colour-coded dots —
  live streams are the hardest thing to see despite being the hero. Its #1
  high-impact bet was live thumbnail markers at close zoom.
- **Product wedge (prior research):** seamless globe→live-video zoom ending on a
  verified-FRESH moving image.

## Current behaviour (what we are changing)

Today (`components/WorldMap.tsx` `wireInteractions`): clicking a camera calls
`overlay.open({kind:"camera",…})`. `<FeedOverlay>` pops a panel **instantly** over
a **static** globe; `<CameraDetail>` fetches `/api/camera/[id]`; `<CameraVideo>`
plays HLS via `/api/hls?id=` (or `<CameraImage>` for stills). There is already a
`flyToPoint(target)` handler registered on the map (used by ⌘K place search). No
animation, no on-map stream preview.

## Architecture (units, each independently testable)

1. **`lib/cinematic/dive.ts`** *(pure, node-testable)* — `computeDive(target, opts?)`
   returns bounded MapLibre camera params `{ center:[lon,lat], zoom, pitch,
   bearing, duration, curve }` for a dive to `{lat,lon}`. Zoom clamped to a
   "street" range (≈14–15), pitch ≈50°, duration ≈1500ms. No MapLibre import.
2. **`lib/cinematic/store.ts`** — framework-light external store
   (`useSyncExternalStore`, mirrors `lib/overlay.ts`). State:
   `{ phase:"idle"|"diving"|"landed"|"leaving", target: WorldObject|null }`.
   Methods: `dive(obj)`, `land()`, `leave()`, `cancel()`, `get()`, `subscribe()`.
   Hook `useDive()`. Pure transition logic is node-testable.
3. **`lib/cinematic/livePick.ts`** *(pure, node-testable)* — `pickLiveCamera(cams)`
   returns a currently-live (`available && live`) camera for the ⌘K showcase, or
   `null` if none. Deterministic — first live match in input order, so it is
   unit-testable.
4. **`components/CinematicDive.tsx`** — orchestrator. Subscribes to the dive store;
   on `diving` it (a) calls `map.diveTo(params)` via a newly-registered map handler
   (sibling to `flyToPoint`), (b) **pre-warms** the stream (kick `/api/camera/[id]`
   + a hidden warm of poster/HLS) so video is buffered by landing; on flyTo
   `moveend`/duration → `store.land()`. Renders the **hero landing card** (reuses
   `<CameraDetail>` body + freshness badge). Handles cancel (Esc / map drag),
   close (→ `leave()` → fly back out), and `prefers-reduced-motion` (skip the
   animation; `diving`→`landed` immediately).
5. **`components/LiveThumbnailLayer.tsx`** — capped pool (≤ `MAX_THUMBS`, e.g. 24)
   of `maplibregl.Marker` HTML elements for in-viewport cameras above
   `THUMB_MIN_ZOOM` (≈12). Each = a rounded `/api/proxy?id=` poster with a small
   freshness tick (reuse `lib/cameras/freshness`). Updates on `moveend`/`zoom`;
   clears below the threshold. Click → `cinematic.dive(obj)`.
6. **`components/WorldMap.tsx`** *(modify)* — register a `diveTo(target)` map handler
   (eased fly with pitch, sibling to `flyToPoint`); change camera click from
   `overlay.open(obj)` to `cinematic.dive(obj)` (**cameras only**; planes / sats /
   webcams / signals keep `overlay.open`); mount `<LiveThumbnailLayer>` wired to the
   map instance. Keep `flyToPoint`/`flyToRegion` intact.
7. **`components/shell/CommandPalette.tsx`** *(modify)* — add command
   `"Dive to a live feed"` → `pickLiveCamera(loaded)` → `cinematic.dive`.

## Data flow

```
click camera ─► cinematic.dive(obj)            (store: phase=diving, target=obj)
                  │
   CinematicDive ─┼─► map.diveTo(computeDive(obj))      (globe flies down)
                  └─► pre-warm: fetch /api/camera/id + warm poster/HLS
                          │
              flyTo moveend / duration ─► store.land()  (phase=landed)
                          │
              hero card materializes ─► <CameraDetail> playing + freshness badge
                          │
              close / Esc ─► store.leave() ─► fly back out ─► phase=idle
```

Reduced motion: `diving`→`landed` immediately (no fly), feed opens instantly.

Live thumbnails: `moveend` → if `zoom ≥ THUMB_MIN_ZOOM`, query rendered `CAM_LAYER`
features in `map.getBounds()`, take up to `MAX_THUMBS`, mount/update Markers; else
clear all. Click → dive.

## Freshness verification (the honesty wedge)

On landing the badge states the truth, prominently:
- **Live HLS:** `● LIVE — streaming`
- **Still:** `Fresh — updated {age} ago · next frame in {countdown}` (reuse
  `lib/cameras/freshness`: `sampledAgeMs`, `msUntilRefresh`, `formatCountdown`).
- **Offline:** `Feed offline` (dive still completes — honest, not faked).

## Error handling / fallbacks

- Live camera → land on playing video (dream case).
- Still camera → land on freshest still + countdown (labelled, never faked as video).
- Offline camera → land gracefully on the offline state.
- ⌘K showcase with no live cameras loaded → command shows a toast / no-op (no crash).
- User pans/zooms during the dive → cancel cleanly to `landed`/`idle`.
- Thumbnail pool hard-capped (`MAX_THUMBS`) and recycled on move (perf guard);
  poster load failure → drop that thumbnail silently.

## Testing strategy

Repo convention: vitest **node** env, no jsdom — unit-test pure logic; verify
components via build + Playwright.

- **Unit (vitest):** `dive.ts` (param bounds / clamping / target center),
  `store.ts` (idle→diving→landed→leaving→idle, cancel, target retention),
  `livePick.ts` (picks live, returns null when none, deterministic order).
- **Runtime (Playwright, `tests/e2e`, like `hls.spec.ts`):** click camera → globe
  flies + video element appears and is playing; ⌘K "Dive to a live feed";
  thumbnails appear past the zoom threshold; reduced-motion path opens instantly.

## Scope / YAGNI

- **In SP6:** traffic cameras only (the live-HLS wow). Webcams / planes / sats /
  signals keep the existing instant overlay.
- **NOT in SP6** — these come from the viz review and belong to the *data-depth
  investigation* (the "After this" task), captured here so they are not lost:
  numeric value labels on signal dots, severity gauges in `SignalDetail`, signal
  heatmap/clustering + per-category glyphs, layer z-order fix, deterministic
  "Live now" highlights panel, per-source camera freshness accuracy. Tracked for
  the next milestone, **not built here**.

## Build sequencing (for the plan)

Each unit ships independently; recommended order:
1. `dive.ts` + `store.ts` + `livePick.ts` (pure, tested) — the spine.
2. `diveTo` handler on WorldMap + `CinematicDive` orchestrator + reduced-motion —
   **the cinematic dive ships here** (the explicit ask).
3. ⌘K "Dive to a live feed" showcase.
4. `LiveThumbnailLayer` — the at-a-glance "see streams" companion.
