# PRD: Responsive / mobile shell with bottom sheets
> Priority: P1 · Effort: M · Status: Proposed · Category: ui-shell

## 1. Summary
Add a dedicated touch/mobile layout for TrafficNerd v2 so the dark ops console is usable one-handed on a phone. On screens `<768px` (or coarse pointers) the MapLibre globe shrinks to the top ~45vh, the left layer rail and right dossier panel collapse into **swipeable bottom sheets**, touch targets grow to 44px, the default layer set is trimmed to **Cameras + Planes** (satellites off) to keep the device light, and a one-time welcome modal teaches the core gestures. Desktop behaviour is unchanged. Outcome: a recruiter or commuter can open the URL on a phone and within seconds tap a plane or camera and read its dossier without pinching at a desktop sidebar.

## 2. Why it matters for TrafficNerd
Transport status is overwhelmingly a phone check — "is my road jammed", "what's that plane overhead", "is the camera at junction X up". The current single MapLibre instance already does Google-Earth zoom, but the surrounding chrome (left rail, right dossier) is desktop-first and overlaps the map on narrow viewports. A real mobile shell turns the project from "desktop demo" into "thing you'd actually pull out of your pocket", which is exactly the portfolio signal worth showing. Trimming the default layers also protects mid-range phones from the satellite.js 1s SGP4 tick and thousands of camera symbols.

## 3. worldmonitor.app reference
worldmonitor detects `<768px`/touch and switches to a stacked layout: map shrinks to ~40vh, layout goes single-column, map labels hide, layer toggles collapse behind a fixed curated set, all controls hit 44px, the DEFCON/FOCUS widgets disappear, the header compacts, and panels become bottom sheets. A first-run welcome modal gives nav tips with a "Don't show again" checkbox. We adapt this to transport: curated set = Cameras + Planes, and the "dossier" bottom sheet is the camera/plane/satellite detail card.

## 4. How we build it (TrafficNerd-specific)
No new data sources — this is pure UI shell over the existing stores and detail components. Keyless throughout; no cross-origin fetch added, so the SSRF/proxy contract is untouched (camera media still goes through `/api/proxy` and `/api/hls`; the client never sees a raw `streamUrl`).

**New: a viewport store (matchMedia, SSR-safe).**
- `lib/useViewport.ts` — `useSyncExternalStore` over `window.matchMedia("(max-width: 767px), (pointer: coarse)")`. Server snapshot returns `false` (desktop) to avoid hydration mismatch; subscribes to the `MediaQueryList` `change` event. Exposes `useIsMobile(): boolean`.

**New: bottom-sheet primitive.**
- `components/BottomSheet.tsx` — fixed-position sheet anchored to the bottom, three snap points (peek ~12vh / half ~50vh / full ~90vh). Drag handled with Pointer Events (`onPointerDown/Move/Up`) translating `transform: translateY`; release snaps to nearest point with a CSS transition; flick-down past threshold dismisses. Backdrop scrim on full. Focus-trapped, `role="dialog"`, `Esc`/swipe-down to close, `aria-label` from the object. Respects `prefers-reduced-motion` (instant snap, no spring).

**Changed: page composition.**
- `app/page.tsx` / a new `components/AppShell.tsx` reads `useIsMobile()`. Desktop branch renders today's `<GlobeView/>` + `<FeedOverlay/>` + `<LayerControl/>` unchanged. Mobile branch wraps the map in a `.map-mobile { height: 45vh }` container and renders the layer rail and the dossier inside `<BottomSheet>`.
- `components/FeedOverlay.tsx` — when mobile, render its kind-specific body (`CameraDetail`/`PlaneDetail`/`SatelliteDetail`, already keyed off `WorldObject.kind`) inside `<BottomSheet>` instead of the right slide-in panel. It already subscribes via `useOverlay()`; opening an object auto-snaps the sheet to half.
- `components/LayerControl.tsx` — mobile variant becomes a compact bottom chip row (Cameras / Planes / Satellites) with 44px hit areas and live counts; expandable to the full toggle list. Reuses `layersStore`.

**Changed: MapLibre style for mobile.**
- In the map init (`components/GlobeView.tsx`/`MapView.tsx`), when mobile: call `map.setLayoutProperty(id,'visibility','none')` on CARTO `*-label`/place-label layers to declutter; enable touch handlers (`map.touchZoomRotate.enable()`, `dragRotate.disable()` to keep pinch = zoom only). `map.resize()` on viewport change so the 45vh container reflows.

**Changed: default layers on mobile.**
- `lib/layers.ts` — keep desktop default `{cameras,satellites,planes}` all true, but expose `mobileDefault = { cameras:true, planes:true, satellites:false }`; `AppShell` applies it once on first mobile mount (guarded so it doesn't fight user toggles).

**New: first-run welcome modal.**
- `components/WelcomeModal.tsx` — shown when `localStorage["tn.welcomeSeen"]` is unset. 3 tips (pinch to zoom, tap a marker for its dossier, swipe the sheet up for detail), "Don't show again" checkbox writing the flag, single Got it button. `role="dialog"`, focus-trapped, dismiss on backdrop/Esc.

**States.** Loading: sheet shows a skeleton card while a `CameraImage`/HLS frame resolves. Empty: tapping nothing keeps the sheet at peek with "Tap a camera or plane". Error: proxied media failure surfaces the existing `CameraImage` error state inside the sheet. Keyboard: Tab cycles within the open sheet/modal; `Esc` closes; the layer chips are real buttons.

## 5. Dependencies & prerequisites
- The single-MapLibre-globe engine (the in-progress rendering rebuild) must be landed first — this PRD styles and reflows that map, it doesn't build it.
- Existing `lib/overlay.ts`, `lib/layers.ts`, `lib/world.ts`, and the three `*Detail.tsx` components (reused as-is).
- No new npm deps — Pointer Events + CSS only (avoids a sheet library). `next/dynamic ssr:false` already isolates the map from SSR.

## 6. Risks & mitigations
- **Hydration mismatch** from viewport detection → server snapshot is always desktop; mobile applied post-mount only.
- **Perf on mid phones** (thousands of camera symbols + 1s satellite tick) → satellites default OFF on mobile; rely on existing symbol clustering / viewport-bounds culling; pause the satellite tick when its layer is off.
- **Sheet vs map gesture conflict** → map touch handlers live only inside the 45vh container; the sheet owns gestures below it; `dragRotate` disabled so a vertical drag never spins the globe.
- **CORS/ToS** → unchanged; all media stays behind the closed `/api/proxy` + `/api/hls` allowlist; no new outbound fetch.
- **Tiny landscape phones** → media query also caps on `max-height` so the 45vh map never collapses the sheet below its peek.

## 7. Acceptance criteria
- [ ] At `<768px` or coarse pointer: map occupies ~45vh top, dossier + layers render as bottom sheets; desktop layout byte-identical to today above 768px.
- [ ] Tapping a marker opens the correct `*Detail` body in a sheet snapped to half; swipe up → full, swipe down → dismiss; `Esc` closes.
- [ ] All interactive controls ≥44px; CARTO label layers hidden on mobile.
- [ ] Default mobile layers = Cameras + Planes on; Satellites off but toggleable.
- [ ] Welcome modal shows once; "Don't show again" persists across reload via `localStorage`.
- [ ] No raw `streamUrl` in client payloads; media still flows through `/api/proxy` + `/api/hls`.
- [ ] `prefers-reduced-motion` removes sheet animation; no hydration warnings in console.
- [ ] Playwright test at 390×844 verifies sheet open/close + curated layer defaults.

## 8. Out of scope / future
- Multi-object / stacked sheets (overlay store is single-object by design).
- Native app / PWA install, offline caching, push.
- Haptics and advanced spring physics.
- Mobile command palette (Ctrl/Cmd-K) — desktop only for now.
- Per-source mobile curation beyond the Cameras+Planes default.
