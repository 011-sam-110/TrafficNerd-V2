# PRD: Live webcams layer
> Priority: P1 · Effort: M · Status: Proposed · Category: data-layer

## 1. Summary
Promote TrafficNerd's ~3,300 traffic CCTV feeds from "markers that pop an image" into a first-class, toggleable **Webcams layer** with worldmonitor-grade **automatic fallback when a feed drops**. The base already ships: source adapters normalize to `Camera` (`lib/sources/*`), `/api/cameras` returns thin markers with `available`/`live`, the SSRF-safe `/api/proxy` (images) and `/api/hls` (video) proxies are closed, and `CameraVideo` already degrades HLS→still. This PRD adds the missing reliability layer — per-feed health tracking, graceful per-marker degradation (live video → still → cached last-good → greyed marker), and live-count UX — so a dead camera never blanks the map or the dossier.

## 2. Why it matters for TrafficNerd
Cameras are TrafficNerd's heart and its largest layer by an order of magnitude. At 3,300 feeds across four+ countries, *some fraction is always dead* (rotated TfL ids, Caltrans maintenance, Digitraffic gaps). Without graceful fallback the map looks broken; with it, the layer reads as a credible global ops console — the exact "monitor the world's transport" promise. This validates the camera-as-map-marker pattern and the fallback behaviour that every other data layer (planes, satellites, vessels) borrows.

## 3. worldmonitor.app reference
worldmonitor exposes "22 live streams across 5 geopolitical regions" as a single toggleable **Webcams** layer with a live count, and handles unavailable streams by swapping in a fallback rather than showing a broken element. We emulate the toggle + live-count + automatic-fallback pattern, scaled from 22 to ~3,300 and driven entirely through our closed proxies.

## 4. How we build it (TrafficNerd-specific)

**Data sources (keyless).** No new upstreams. Reuse the existing registry (TfL, Caltrans, SCDOT, Digitraffic) merged via `Promise.allSettled` with stale-cache fallback. All media flows through `/api/proxy` and `/api/hls` only.

**Health tracking (NEW).** Add `lib/cameras/health.ts` — an in-memory `Map<id, {state, lastGoodAt, fails}>` updated by the proxies. In `app/api/proxy/route.ts` and `app/api/hls/route.ts`, on upstream 2xx mark `live`; on 404/502/timeout increment `fails` and mark `degraded` (≥2) / `dead` (≥4). `/api/cameras` already returns `available`/`live`; extend it to fold in `health` state so the client knows a marker's status without fetching media.

**MapLibre layers/expressions.** Reuse the existing camera symbol source. Drive icon **opacity/colour by health** with a data expression on a per-feature `health` property: `icon-opacity` = `["match", ["get","health"], "dead", 0.35, 1]`; greyscale (region-coloured → desaturated) for `degraded`/`dead` via a separate `icon-image` suffix (`cam-tfl-dead`). Keep symbols GPU-side; never DOM markers at this scale. Clustering is handled by the separate `smart-marker-clustering` spec.

**Per-marker media fallback (NEW).** Generalize `CameraVideo`'s existing HLS→still fallback into an explicit chain in `CameraDetail`: **live video → still (`/api/proxy`) → last-good cached still → greyed "feed offline" card**. Add `components/CameraFeed.tsx` owning this state machine (loading skeleton, `onError` cascade, retry-with-backoff button). `/api/proxy` returns `last-good` from a tiny LRU when the upstream 502s (header `x-feed: stale`) so a momentary blip shows the previous frame, not a 404.

**Files to ADD:** `lib/cameras/health.ts`, `components/CameraFeed.tsx`, `lib/cameras/useCameraHealth.ts` (poll hook over `/api/cameras`).
**Files to CHANGE:** `app/api/cameras/route.ts` (emit `health`), `app/api/proxy/route.ts` + `app/api/hls/route.ts` (record health + stale-cache), `components/CameraDetail.tsx` (use `CameraFeed`), `components/GlobeView.tsx` (health-driven icon expressions), `components/LayerControl.tsx` (Webcams toggle + `live/total` count), `lib/layers.ts` (already has `"cameras"` — keep).

**SSRF/proxy.** Unchanged guarantees: client never sees a raw `imageUrl`/`streamUrl`; every outbound fetch stays host+path allowlisted (`lib/proxy/allowlist.ts`, `hls-allowlist.ts`), `redirect:'error'`, `AbortSignal.timeout`. Health is derived server-side; the stale-cache only ever replays bytes that already passed the allowlist.

**UX/states.** Toggle Webcams from the layer rail (`W` keyboard shortcut + command-palette entry); count shows `Live 3,118 / 3,300`. Loading = skeleton; offline = greyed marker + "Feed offline — last seen 4m ago" card with Retry; dead feeds dim but remain clickable. Empty coverage = "no cameras in view".

## 5. Dependencies & prerequisites
- P0 MapLibre single-engine shell (`unified-globe-flat-map-engine`) for symbol layers + click→dossier.
- Existing SSRF proxies and source registry — no new npm deps.
- Plays alongside `smart-marker-clustering` (handles density) and `dark-ops-console-shell`/`left-layer-rail` (toggle UI).

## 6. Risks & mitigations
- **Proxy load at 3,300 feeds:** keep `Cache-Control: max-age=refreshSeconds` (TfL 300s) so CDN/browser absorb repeats; health checks piggyback on real media fetches, no extra polling of upstreams.
- **False "dead" on transient blips:** require ≥4 consecutive fails before `dead`; auto-recover on next 2xx; stale-cache covers single blips.
- **Memory growth of last-good LRU:** cap entries + bytes (e.g. 200 stills), evict oldest.
- **ToS/attribution:** mandatory per-feed attribution stays in `AttributionBadge`; honour each source's refresh floor.

## 7. Acceptance criteria
- [ ] Webcams is a single toggleable layer with a `live/total` count; `W` toggles it.
- [ ] Dead/degraded feeds render as dimmed/greyed markers (not removed, not broken).
- [ ] Opening a degraded camera cascades live video → still → last-good → "feed offline" card with Retry, never an error/blank.
- [ ] A momentary upstream 502 shows the last-good frame (`x-feed: stale`), not a 404.
- [ ] Health derives server-side; no raw upstream URL reaches the client; allowlist unchanged.
- [ ] `lib/cameras/health.ts` state machine is unit-tested; `npm test` green.

## 8. Out of scope / future
New camera sources (Norway/Sweden/NZ/Canada — researched separately); clustering (own spec); per-feed historical uptime charts; client-side recording/snapshots; ML scene/incident detection on frames; user-submitted cameras.
