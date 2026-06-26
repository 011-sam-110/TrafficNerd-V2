# PRD: Zero-friction instant load (no signup)

> Priority: P0 · Effort: M · Status: Proposed · Category: ui-shell

## 1. Summary

Make TrafficNerd v2 fully usable the instant the URL resolves: no login, no paywall, no trial clock, no consent wall. The MapLibre globe paints, and camera + plane markers appear, within a few seconds of first byte — then satellites (client-side SGP4) and plane trails hydrate progressively without blocking that first paint. This is the shell-level contract every other layer builds on.

## 2. Why it matters for TrafficNerd

A live-transport monitor is only impressive if a stranger sees moving data immediately. The value prop — "watch real CCTV, aircraft and satellites on one globe" — must land before any patience is spent. For a portfolio piece, a recruiter opening the link should see the spinning dark globe with ~3,300 camera dots and live planes within seconds, prove it is real by clicking a dossier, and never hit a sign-in. Zero friction is the difference between "neat" and "they bounced."

## 3. worldmonitor.app reference

worldmonitor states "No login. No paywall. No data collection." All six monitors (conflicts, vessels, flights, fires, outages) render as the page loads; the full live map is free with no signup. We adapt the *behavior* (instant, anonymous, complete) not the implementation: our layers are cameras / aircraft / satellites, and we add a deliberate paint-order so the heaviest client computation (SGP4) never delays first interaction.

## 4. How we build it (TrafficNerd-specific)

**Data sources (keyless).** Cameras via the existing registry (`lib/sources/registry.ts`, `Promise.allSettled` + stale-cache) served by `app/api/cameras/route.ts`. Planes via `app/api/planes/route.ts` (adsb.lol). Satellites computed client-side from CelesTrak TLEs (`lib/satellites/propagate.ts`). No source on the critical path requires a key, cookie, or auth handshake.

**Paint-order contract.** Define three hydration phases in a small store `lib/boot/useBoot.ts` (`useSyncExternalStore`):
- *Phase 0 (instant):* MapLibre map mounts with CARTO dark vector style (keyless, OSM-derived) + `projection: 'globe'`. No data needed — the globe is visible immediately.
- *Phase 1 (seconds):* fetch `/api/cameras` and `/api/planes` in parallel; push results through the `WorldObject` seam (`lib/world.ts`) into MapLibre GeoJSON sources `cameras-src` and `planes-src`. Markers paint.
- *Phase 2 (deferred):* after first idle (`requestIdleCallback`), start the satellite 1s SGP4 tick (`lib/satellites/useSatellites.ts`) and plane trail accumulation (`lib/planes/trail.ts`).

**MapLibre layers.** Add GeoJSON sources for cameras/planes/satellites; symbol layers using the existing hand-drawn SVG icon images (`lib/icons`). Camera layer uses a low `minzoom`-independent circle/symbol with clustering deferred (see scope). Planes use `icon-rotate: ['get','heading']`.

**Rendering of remote media.** Markers carry only `id` + coordinates; no `streamUrl` ever reaches the client. Dossier image/video on click goes through `/api/proxy` and `/api/hls` exactly as today — instant load does not weaken the SSRF allowlist.

**Files to ADD:** `lib/boot/useBoot.ts` (phase store + orchestration), `components/BootSkeleton.tsx` (globe-shaped shimmer + "Connecting to live feeds…" status).
**Files to CHANGE:** `app/page.tsx` (mount map first, render skeleton until Phase 0 style load), `components/GlobeView.tsx` (consume boot phases; lazy-init satellites/trails on Phase 2), `app/layout.tsx` (no auth/consent providers; preconnect hints), `next.config.ts` (no auth middleware).

**Performance hints:** `<link rel="preconnect">` for the CARTO tile host, adsb.lol, and own `/api` origin; mark `/api/cameras` and `/api/planes` as edge/Node with short `Cache-Control: s-maxage` + `stale-while-revalidate` so cold first paint is fast and shared.

**UX/states.** Loading = globe skeleton with phase status text. Empty (a source returns 0) = silent, counts read 0, no modal. Error (a fetch fails) = degrade silently to the layers that succeeded; the bottom freshness ticker shows the failed source as "stale," never a blocking error. Keyboard: nothing required before interaction; Ctrl/Cmd-K palette available once Phase 0 completes.

## 5. Dependencies & prerequisites

- The MapLibre single-engine shell (the globe/zoom rebuild) must exist or land alongside this — this PRD owns its boot sequencing.
- Reuses existing `lib/sources/registry.ts`, `app/api/cameras|planes`, `lib/world.ts`, `lib/icons`, `/api/proxy`, `/api/hls`. No new libraries beyond `maplibre-gl` (already planned) and `satellite.js` (already present).

## 6. Risks & mitigations

- **adsb.lol / CelesTrak rate or outage:** wrap in `Promise.allSettled`; a failed plane/satellite fetch must not block camera paint or the globe. Cache TLEs in `localStorage` for repeat visits.
- **Thousands of camera markers hurting first paint:** Phase 1 ships markers as a single GeoJSON source (one layer, GPU-batched), not per-marker React nodes; heavy clustering deferred to a later PRD.
- **CARTO tile limits:** keyless demo tiles are fine for portfolio scale; document the self-host fallback (PMTiles) as future.
- **CORS:** all cross-origin media stays behind the existing allowlisted proxies; data APIs are same-origin (`/api/*`).
- **ToS:** keyless/free sources only; attribution rendered via existing `AttributionBadge`.

## 7. Acceptance criteria

- [ ] Visiting `/` cold shows the dark globe with no login, paywall, consent banner, or network auth call.
- [ ] Camera and plane markers are visible within ~3s of first paint on a typical broadband connection.
- [ ] Satellites and plane trails appear *after* markers, started on idle, and their absence never delays Phase 1.
- [ ] If `/api/planes` (or any one source) fails, cameras still render and the ticker marks that source stale — no blocking error.
- [ ] No `streamUrl` is present in any client payload; all media routes through `/api/proxy` / `/api/hls`.
- [ ] Lighthouse: no render-blocking auth script; LCP (globe canvas) under target on repeat load.
- [ ] App is interactive (pan/zoom, click dossier, Ctrl/Cmd-K) with zero stored cookies for auth.

## 8. Out of scope / future

Marker clustering / LOD thinning at scale; offline/PWA caching; per-user saved views or preferences (would reintroduce friction); self-hosted PMTiles basemap; analytics (must remain "no data collection").
