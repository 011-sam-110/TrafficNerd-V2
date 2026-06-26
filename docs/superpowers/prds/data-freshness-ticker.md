# PRD: Data-freshness ticker / source monitor
> Priority: P1 · Effort: M · Status: Proposed · Category: ui-shell

## 1. Summary
A persistent, always-visible read on how fresh every data stream is. A bottom **freshness ticker** shows one chip per adapter (TfL, Caltrans, SCDOT, Digitraffic, adsb.lol, CelesTrak) with its last-success age, a live/stale/down state, and object count. A `STALE` badge appears the moment the registry serves its `Promise.allSettled` stale-cache fallback. The clicked-camera dossier additionally shows a per-camera `refreshSeconds` countdown to the next image/HLS pull. Outcome: users (and recruiters) can trust exactly what they are seeing and how old it is, with zero new keys or paid services.

## 2. Why it matters for TrafficNerd
A transport console lives or dies on trust. A JamCam frozen at a 90-second-old frame, a Caltrans region that quietly 500s, or an `adsb.lol` poll that drops to stale cache all look identical on the map — a sea of dots. Surfacing per-source age turns "is this real-time?" from a guess into a fact, and makes the SSRF-proxied, multi-source, fallback-capable backend *visibly* honest. It is also the cheapest way to make the dense ops-console aesthetic feel alive.

## 3. worldmonitor.app reference
worldmonitor puts inline source citations and timestamps everywhere and runs a freshness monitor covering 35 source groups across 65+ providers, surfacing last-update age and stale states so users trust the feed. We adapt the *behaviour* (per-source age + explicit stale flagging) to our six adapters and our per-camera refresh model — not its scale or layout.

## 4. How we build it (TrafficNerd-specific)

**Data sources / endpoints (all keyless, already wired):** no *new* outbound calls. Freshness is derived from the existing fetches in `lib/sources/{tfl,caltrans,scdot,digitraffic,adsb,celestrak}.ts` and the `getRegistry()` cache in `lib/sources/registry.ts`.

**Backend — capture per-source status.**
- ADD `lib/sources/status.ts`: a tiny server-side store `recordSource(id, {ok, count, at, error?})` + `getSourceStatus(): SourceStatus[]`. Shape: `{ id, name, ok, count, lastSuccessAt, ageMs, stale }`.
- CHANGE `lib/sources/registry.ts`: in `getRegistry()`, after `Promise.allSettled`, call `recordSource` per settled result (fulfilled → ok+count+now; rejected → ok:false, keep prior `lastSuccessAt`). Set `stale:true` on the whole batch when `mergeResults` falls back to `cache.cameras` (extract a boolean from `mergeResults` instead of swallowing it).
- CHANGE `lib/sources/adsb.ts` and `lib/sources/celestrak.ts`: call `recordSource("adsb"/"celestrak", ...)` inside their existing cache/failure paths (both already "serve stale/empty" — just report it).
- ADD `app/api/status/route.ts` (`force-dynamic`): `Response.json({ at: Date.now(), sources: getSourceStatus() })`. No raw URLs, no stream URLs — counts and timestamps only.

**Client — store + ticker.**
- ADD `lib/freshness.ts`: external store (same `useSyncExternalStore` pattern as `lib/overlay.ts`/`lib/layers.ts`) that polls `GET /api/status` every 15s, plus a `useNow(1000)` 1s ticker so ages count up smoothly between polls (compute `ageMs = now - lastSuccessAt` client-side; never trust the server clock for the seconds digit).
- ADD `components/FreshnessTicker.tsx`: fixed bottom bar, monospaced numerics, one chip per source: icon · short name · `count` · `12s` age · state dot. State = **live** (green, age < 2×refresh), **lagging** (amber, 2–4×), **stale** (orange, fallback served), **down** (red, last fetch failed). Whole-bar `STALE — showing cached data` banner when any source reports `stale`.
- CHANGE `app/page.tsx`: mount `<FreshnessTicker />` in the shell alongside `LayerControl`/`FeedOverlay`.
- CHANGE `components/CameraDetail.tsx`: add a per-camera countdown from `camera.refreshSeconds` and `lastSampledAt` — "next frame in 7s" with a thin progress bar; resets when `CameraImage`/`CameraVideo` reload.

**UX / states.** Loading → skeleton chips with `--` ages. Empty (status fetch fails) → bar stays, all chips `down`, banner "source monitor offline". Hover a chip → tooltip with exact ISO timestamp + last error string. Click a chip → toggles that layer via `layersStore` (cameras/planes/satellites map directly; the four camera adapters all toggle the `cameras` layer). Keyboard: ticker reachable via Tab; chips are buttons; respects the existing Ctrl/Cmd-K palette (add a "Jump to source status" command later).

**SSRF/proxy.** None added — `/api/status` only reads in-process status. The client still never receives a raw `streamUrl`; chips expose counts/ages only.

## 5. Dependencies & prerequisites
- Existing `lib/sources/registry.ts` `Promise.allSettled` + stale-cache path (present).
- External-store pattern from `lib/overlay.ts` / `lib/layers.ts` (reuse, no new deps).
- Icon set `lib/icons/svg.ts` for chip glyphs.
- Pairs with the `layer-rail` / `command-palette` shell PRDs (chips toggle the same `layersStore`); not blocked by them.

## 6. Risks & mitigations
- **Server statelessness on Vercel:** the in-process status store resets per cold serverless instance, so ages can read "fresh" right after a cold start. Mitigation: derive age purely from `lastSuccessAt` timestamps; on a cold instance with no record yet, show `--`/`unknown` rather than a false "live".
- **Clock skew:** compute ages client-side from server-provided `lastSuccessAt` epochs; ignore the seconds field if `at` and client clock differ by > 5s.
- **Poll cost:** `/api/status` is metadata-only and 15s-polled — negligible vs the camera/plane feeds.
- **Per-camera countdown drift** at thousands of cameras: only the *open* dossier camera runs a countdown; the ticker never iterates per-camera.
- **ToS:** no extra fetches, so no new rate-limit or attribution exposure.

## 7. Acceptance criteria
- [ ] `GET /api/status` returns one entry per source with `name`, `count`, `lastSuccessAt`, `stale`, `ok` — and never a URL/stream URL.
- [ ] Bottom ticker renders six chips with live-counting ages (monospaced).
- [ ] Killing/forcing-fail one adapter flips its chip to `down`/`stale` within one poll cycle, and the `STALE` banner appears when the registry serves cached cameras.
- [ ] Camera dossier shows a `refreshSeconds` countdown that resets on image/HLS reload.
- [ ] Clicking a chip toggles the matching `layersStore` layer; chips are keyboard-focusable buttons.
- [ ] No new outbound hosts; SSRF allowlist unchanged; build + existing unit tests pass.

## 8. Out of scope / future
Historical uptime sparklines/graphs, alerting/notifications, a full 35-group monitor page, persisting status across serverless instances (KV/Edge Config), and per-camera *individual* staleness on the map (color-by-age heat). Defer until more sources land.
