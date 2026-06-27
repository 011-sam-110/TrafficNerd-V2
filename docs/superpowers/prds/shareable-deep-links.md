# PRD: Shareable deep links & map pinning
> Priority: P2 · Effort: M · Status: Proposed · Category: map-interaction

## 1. Summary
Make the entire view state of TrafficNerd v2 addressable by URL: camera/lon/lat/zoom, which layers are on, active region/source filters, and a focused WorldObject (a specific camera, flight, or satellite). The URL updates as the user pans, toggles layers, or clicks an object, and on load the app restores that exact state. Result: any view is bookmarkable, shareable (Slack/Twitter/recruiter), and back/forward-navigable — zero new dependencies, all client-side.

## 2. Why it matters for TrafficNerd
Transport scenes are inherently "look at this" moments: "watch this A4 jam cam", "this 747 over the Atlantic (hex 3c4b2d)", "all of SoCal's freeway cams". Without deep links those are unshareable — the recipient lands on London. Deep links turn every camera, flight, and orbit into a permalink, which is strong portfolio polish (demonstrates URL-as-state discipline) and the backbone for future features like saved views and OG share-card previews.

## 3. worldmonitor.app reference
worldmonitor encodes `lat`, `lon`, `zoom`, `time`, `view`, and active `layers` into query params (e.g. `?lat=38.9&lon=-77&zoom=6&layers=bases,conflicts`), validated and clamped on read, and supports pinning the map to the top or letting it scroll. We adapt: same param-encoded view state, plus a TrafficNerd-specific `obj` param for a focused WorldObject, and clamping driven by our Zod schemas.

## 4. How we build it (TrafficNerd-specific)
No external data — this is pure client state serialization. URL is the source of truth that hydrates the existing external stores.

**New file `lib/viewState.ts`** — a Zod schema + codec:
- Params: `lat`, `lon` (clamped to types.ts bounds ±90/±180), `z` (POV altitude / map zoom, clamped to the GlobeView `MAP_THRESHOLD`/`EXIT_ALTITUDE` range), `layers` (csv subset of `LayerKey` = `cameras,satellites,planes`), `src` (csv of `KNOWN_REGIONS` = tfl,caltrans,scdot,digitraffic for `cameraFilter`), and `obj` (a namespaced WorldObject id, e.g. `plane:3c4b2d`, `tfl:JamCams_00001`, `sat:25544`).
- `encode(state): string` and `parse(searchParams): Partial<ViewState>` with `safeParse` + clamp; invalid params are dropped, never thrown.

**New `lib/viewSync.ts` (client hook `useViewStateSync`)** mounted in `GlobeView`:
- On mount: read `window.location.search`, hydrate `layersStore.set`, `cameraFilterStore`, set `focus`/POV, and if `obj` present resolve it from the loaded `pts`/plane/satellite arrays and call `overlay.open(...)` (retry once after first data fetch resolves, since planes/sats stream in).
- Subscribe to `overlay`, `layersStore`, `cameraFilterStore`, and the globe `onZoom`/`onPointClick` callbacks; debounce (300ms) writes via `history.replaceState` (replace, not push, for pan/zoom; `pushState` only on a new `obj` focus so back-button closes the dossier).

**Changes:**
- `components/GlobeView.tsx` — call `useViewStateSync()`; emit current POV from existing `globeRef`/`onZoom`; accept hydrated initial `focus`/altitude instead of always `HOME`.
- `components/MapView.tsx` — report `map.getCenter()/getZoom()` on `moveend` into the same codec.
- `components/FeedOverlay.tsx` — add a "Copy link" button (writes `navigator.clipboard.writeText(location.href)` after a fresh `encode`), with a 1.5s "Copied" state and a `prompt()` fallback.
- `app/layout.tsx` / new `components/PinToggle.tsx` — a small pin/unpin control toggling a `position: sticky` vs `fixed` class on `<main class="globe">` (the worldmonitor "pin to top vs scroll" behaviour); default pinned/full-bleed.

**UX/states:** invalid/garbage params → silently fall back to `HOME` defaults (no error UI). Loading: if `obj` references an object not yet streamed, show the dossier in a "Locating…" skeleton until the next data tick, then either populate or quietly close. Keyboard: deep-link/copy is also exposed in the Cmd-K command palette once that exists.

**SSRF/proxy:** none introduced — no cross-origin fetch. The `obj` id is an opaque internal key; camera media still flows only through the existing `/api/proxy` and `/api/hls` allowlisted proxies, so a shared link never exposes a raw `streamUrl`.

## 5. Dependencies & prerequisites
- Existing stores: `lib/overlay.ts`, `lib/layers.ts`, `lib/cameraFilter.ts`, `lib/world.ts`, `lib/types.ts` (clamp bounds). No new libs (Zod already in repo).
- Soft dependency: command-palette feature (Cmd-K) for surfacing "Copy link"; not blocking.
- Synergises with a future `og-share-cards` PRD (server reads the same params).

## 6. Risks & mitigations
- **URL churn / history spam** from pan/zoom → debounce + `replaceState` (only `obj` focus uses `pushState`).
- **Stale object ids** (a flight lands, NORAD decays) → graceful "not found" → close dossier, keep map state.
- **Hydration mismatch** (Next 15) → all sync runs in `useEffect` client-side; `page.tsx` already loads `GlobeView` with `ssr:false`.
- **Scale**: encoding is O(1) on a handful of state values, independent of the ~3,300 cameras / hundreds of planes.
- **No ToS/CORS exposure** — no third-party calls added.

## 7. Acceptance criteria
- [ ] Panning/zooming the globe or map updates the URL (debounced, via `replaceState`).
- [ ] Toggling a layer or region filter reflects in `layers=`/`src=`.
- [ ] Clicking a camera/plane/satellite adds `obj=` and `pushState`; browser Back closes the dossier.
- [ ] Pasting a full URL into a fresh tab restores POV, layers, filters, and reopens the same object (or degrades gracefully if gone).
- [ ] Malformed params never throw; app loads at `HOME` defaults.
- [ ] "Copy link" copies the current canonical URL with a confirmation state.
- [ ] Pin toggle switches the map between pinned full-bleed and scroll-with-page.
- [ ] No raw `streamUrl` ever appears in any shared URL.

## 8. Out of scope / future
Named/saved views or server-side persistence; server-rendered OG/Twitter share-card images (separate PRD); `time=` time-travel/replay params; short-URL service; multi-object selection in one link.
