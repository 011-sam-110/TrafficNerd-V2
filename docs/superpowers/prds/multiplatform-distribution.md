# PRD: Multi-platform distribution (desktop/PWA/TV + i18n)
> Priority: P3 · Effort: M · Status: Proposed · Category: ui-shell

## 1. Summary
Make TrafficNerd v2 *installable and presentable* beyond a browser tab. v1 ships two cheap, portfolio-grade wins: (a) an installable **PWA** with a service worker that offline-caches the app shell and basemap tiles, and (b) a full-screen, no-chrome **Wall Mode** that auto-rotates between saved camera/region views for a transport NOC display. Native desktop (Tauri), store apps, and 24-language i18n are explicitly scoped *out* of v1 and captured as future work, but we lay the i18n seam (a `t()` wrapper + one extracted string catalog) so it is non-breaking to add later.

## 2. Why it matters for TrafficNerd
A transport operations centre (airport ops, port/harbour board, highway control room) lives on wall-mounted displays. A full-screen auto-rotating view of live CCTV + inbound aircraft + tracked satellites *is* the product in that setting — it turns the web app into a kiosk artifact you can leave running on a TV. The PWA angle means a duty officer can "install" TrafficNerd to a taskbar/home screen and have the app shell + last-seen basemap survive a flaky network — useful exactly when monitoring infrastructure incidents. Both are honest, shippable, and demo extremely well in a portfolio without inventing new data.

## 3. worldmonitor.app reference
worldmonitor ships an installable PWA with offline map caching, native desktop builds via Tauri 2 (macOS/Windows/Linux) with a Node.js sidecar, an Android TV wall-display build, iOS/Android store apps, and 24-language localization with native-language feeds and RTL. We adapt only the *web-native* slice (PWA + wall display + i18n seam) and deliberately drop the native/sidecar/store complexity as YAGNI for a solo portfolio repo.

## 4. How we build it (TrafficNerd-specific)
**No new data sources.** Reuses the existing camera registry, adsb.lol planes, satellite.js, and the closed `/api/proxy` + `/api/hls` proxies unchanged. Wall Mode is a pure consumer of existing stores; the client still never sees a raw `streamUrl`.

**PWA**
- ADD `app/manifest.ts` (Next 15 Metadata route) — `name`, `short_name: "TrafficNerd"`, `display: "standalone"`, dark `theme_color`/`background_color`, and icon set (192/512/maskable) drawn from the existing hand-drawn SVG set, rasterized into `public/icons/`.
- ADD `public/sw.js` + ADD `components/ServiceWorkerRegister.tsx` (a `"use client"` component mounted in `app/layout.tsx` that registers `/sw.js` only in production). No Workbox dependency — hand-rolled to stay keyless/dependency-light.
- Service worker strategy: **cache-first** for the static app shell (`/`, JS/CSS, icons); **stale-while-revalidate** for CARTO basemap vector tiles (`*.basemaps.cartocdn.com`) and country-border GeoJSON, capped via an LRU eviction (max ~400 tile entries) in a dedicated cache name. **Network-only (never cache)** for `/api/proxy`, `/api/hls`, and any live-data fetch — stale camera frames or HLS segments must not be served offline; show the existing stale/error state instead.
- CHANGE `app/layout.tsx` to add viewport/theme-color metadata and mount `<ServiceWorkerRegister/>`.

**Wall Mode**
- ADD `app/wall/page.tsx` — a route that renders the existing `MapView`/`GlobeView` engine with the top bar, left rail, and dossier panel hidden (a `chromeless` prop or layout flag), plus a minimal corner clock + data-freshness ticker.
- ADD `lib/wall/playlist.ts` + a small `useSyncExternalStore` store `lib/wall/store.ts` holding an ordered list of "scenes" (each = `{ center, zoom, layerFilter, dwellSeconds }`). A scene can be a saved region (reuse `RegionJump` targets) or a single pinned camera/airport.
- ADD `components/WallController.tsx` — a `setInterval` driver that calls `map.flyTo(scene)` and applies the scene's layer filters via the existing overlay/layers stores, advancing every `dwellSeconds` (default 20s). Pauses on the camera/plane currently selected; resumes on idle.
- Scenes are configured via URL query (`/wall?scenes=london,heathrow,bayarea&dwell=20`) so a wall display needs zero login and a single bookmarkable URL — honoring the zero-friction constraint.
- UX/states: request **Wake Lock** (`navigator.wakeLock`) so the screen never sleeps; auto-enter browser fullscreen on a user gesture (kiosk caveat noted). Empty playlist → fall back to a slow auto-orbit of the globe. A camera that errors mid-scene shows the existing error tile and the rotation continues (never blocks). Keyboard: `←/→` step scenes, `Space` pause/resume, `Esc` exit fullscreen.

**i18n seam (foundation only)**
- ADD `lib/i18n/index.ts` exposing `t(key)` + a `lib/i18n/en.ts` catalog, and migrate visible UI strings in the shell components to keys. No second language ships in v1; this just makes the later 24-locale add a data-only change. Numerics stay monospaced/locale-neutral.

## 5. Dependencies & prerequisites
- Depends on the core **map-shell / single-MapLibre-engine** PRD (Wall Mode reuses `MapView`/`GlobeView` and `flyTo`).
- Depends on the **icon-set** (single source of truth) for manifest icons.
- Reuses `cameraFilter.ts`, `overlay.ts`, `layers.ts`, `RegionJump`. No new npm packages (manifest via Next metadata; SW hand-rolled).

## 6. Risks & mitigations
- **Caching live data by mistake** → strict allowlist in `sw.js`; `/api/*` is network-only, asserted by a unit test that the SW fetch handler bypasses cache for those paths.
- **Stale shell after deploy** → version the cache name with the build id and `skipWaiting`/`clients.claim`; old caches purged on `activate`.
- **CARTO tile ToS / volume** → cap LRU entries and respect attribution; SWR keeps freshness, eviction bounds disk. Attribution badge stays visible in Wall Mode.
- **Fullscreen/Wake Lock browser gating** → both require a gesture and degrade gracefully (overlay "Click to start wall mode"); never assume kiosk autoplay.
- **Performance on a TV** → Wall Mode dwell + `flyTo` is light; reuse existing marker virtualization so thousands of cameras / hundreds of planes don't regress on low-power display hardware.

## 7. Acceptance criteria
- [ ] Lighthouse "Installable PWA" passes; app installs to taskbar/home screen with correct dark icon + name.
- [ ] With network throttled offline, the app shell loads and the last-seen basemap renders; live camera/plane fetches show the existing error/stale state (not stale cached frames).
- [ ] `/wall?scenes=london,heathrow,bayarea&dwell=15` loads chromeless, auto-rotates every 15s, keeps the screen awake, and shows the freshness ticker.
- [ ] `←/→/Space/Esc` keyboard controls work; selecting an object pauses rotation.
- [ ] No raw `streamUrl` reaches the client; SW never caches `/api/proxy` or `/api/hls` (unit test green).
- [ ] All shell UI strings resolve through `t()` against `en.ts`; no hard-coded user-facing strings remain in shell components.
- [ ] Commits are solo-attributed (no Co-Authored-By trailer).

## 8. Out of scope / future
- Native desktop (Tauri 2) builds + any Node.js sidecar.
- iOS/Android store apps and Android TV native build.
- The remaining 23 locales, native-language feeds, and RTL layout (the seam is ready; this is a data-only follow-up).
- Per-user saved wall playlists / accounts (kept URL-driven and stateless in v1).
