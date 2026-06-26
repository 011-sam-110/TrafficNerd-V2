# PRD: Satellite / orbit tracking (SGP4)
> Priority: P1 · Effort: M · Status: Proposed · Category: data-layer

## 1. Summary
Ship a first-class **Satellites layer** on TrafficNerd v2's single MapLibre globe: live ground positions for ISS, Starlink, navigation, weather and other tracked objects, propagated client-side from CelesTrak TLEs with `satellite.js` SGP4 on a 1s tick. The engine already exists in `lib/satellites/`; this PRD finishes it — porting the existing `react-globe.gl` rendering to MapLibre GeoJSON sources, adding worldmonitor-style **groupings** (Stations / Starlink / OneWeb / Navigation / Other), a live **orbit ground-track** for the selected satellite, and an **overhead / next-visible-pass** computation for the dossier panel — so the layer is genuinely useful, not just decorative.

## 2. Why it matters for TrafficNerd
TrafficNerd watches things that move through the transport domain — cameras on the ground, aircraft in the air, and satellites in orbit. Satellites complete the vertical stack and are the layer that makes the spinning-globe view feel alive when you zoom out past street level. The payoff is the dossier: "is the ISS over me right now, and when does it next pass?" is the canonical worldmonitor moment, and it ties orbital data to the user's actual location the same way our camera/plane layers tie data to place.

## 3. worldmonitor.app reference
worldmonitor computes orbital positions in-browser with SGP4 and renders a toggleable Satellites layer on the globe, grouping the catalogue into recognisable buckets — **ISS / crewed stations, Starlink, and military/other** — and framing each object around **whether it is overhead and when it next passes** the viewer. We emulate the groupings and the overhead/visible-pass framing; we do **not** copy their renderer (we are on MapLibre, not their stack).

## 4. How we build it (TrafficNerd-specific)

**Data sources (keyless).** CelesTrak GP/TLE already wired in `lib/sources/celestrak.ts` (`gp.php?GROUP=<g>&FORMAT=tle`, 2h per-group cache + stale fallback). Fetch the groups `stations`, `starlink`, `oneweb`, `gnss`, and `visual`, dedupe by NORAD id, classify the remainder via the existing `classifySatellite()`. Ground imagery in the dossier reuses Esri World Imagery export (already in `SatelliteDetail.tsx`).

**MapLibre rendering (replaces the `react-globe.gl` object layer).** The hook `useSatellites()` already emits `WorldObject[]` every tick — keep it as the single source of truth. Add a thin renderer that converts those objects into one GeoJSON `FeatureCollection` and updates a `satellites` source via `map.getSource('satellites').setData(fc)` on each tick (do NOT re-add layers; mutate source data only).
- `symbol` layer `satellites-symbols`: `icon-image` driven by `["get","icon"]` (the existing `sat-*` SVG images registered with `map.addImage`), `icon-allow-overlap:true`, `symbol-sort-key` so stations sit on top.
- `line` layer `satellite-track`: ground track of the **selected** satellite only — propagate ±1 orbital period (`meta.periodMin`) in ~90s steps, split the polyline at the antimeridian, paint with the sat's `color`.
- Altitude is compressed for display but `altKm` is preserved in `meta` for the dossier (contract already documents this).

**Files to ADD:** `lib/satellites/render.ts` (WorldObject[]→GeoJSON + antimeridian-safe track builder), `lib/satellites/passes.ts` (pure `nextPass(satrec, observerLatLon)` + `isOverhead()` using elevation-angle from the SGP4 look-angles), `components/SatelliteLayer.tsx` (subscribes to `useSatellites()` + `useLayers()`, drives the MapLibre source). **Files to CHANGE:** `app/api/satellites/route.ts` (accept multiple groups + dedupe), `lib/satellites/useSatellites.ts` (multi-group load), `components/SatelliteDetail.tsx` (add overhead badge + next-pass row + AOS/LOS times), `lib/layers.ts` (already has the `satellites` key — add sub-group toggles), `lib/proxy/allowlist.ts` (ensure `celestrak.org` and `server.arcgisonline.com` are allowlisted hosts for the image proxy).

**UX.** Layer rail toggle with a live count; group sub-toggles (Stations/Starlink/OneWeb/Nav/Other) with per-group counts. Click → dossier shows name, NORAD id, type, altitude, velocity, period, **OVERHEAD** pill when elevation > 10°, and **Next pass: in 12m (AOS 21:14 → LOS 21:20)** using the browser geolocation (graceful "enable location for pass times" when denied). Selecting a satellite draws its ground track; deselect clears it. Loading = skeleton count; CelesTrak error = layer stays off with a ticker note (route already returns `{satellites:[]}` on failure). Keyboard: `S` toggles the layer; Esc closes the dossier.

**SSRF/proxy.** No raw URLs reach the client for imagery — `SatelliteDetail` Esri requests route through `/api/proxy` against the allowlist. CelesTrak is fetched server-side only (the API route); the client only ever sees parsed TLE strings, never an arbitrary outbound URL.

## 5. Dependencies & prerequisites
- `satellite.js` (already a dependency) and `maplibre-gl` (core engine — depends on the single-MapLibre-instance shell PRD).
- SSRF image proxy `/api/proxy` (existing) + its allowlist entry for Esri/CelesTrak.
- The shared `WorldObject` contract, `overlay`, and `layers` stores (existing).
- Icon set `lib/icons/svg.ts` `SAT_META` (existing) registered as MapLibre images by the map shell.

## 6. Risks & mitigations
- **Catalogue size / perf:** `active` is ~11k objects; default to the curated groups (stations+starlink+oneweb+gnss+visual ≈ a few thousand) and cap rendered symbols by viewport + zoom. SGP4 for a few thousand sats at 1Hz is fine; if the tick janks, drop to 2s or only propagate symbols in view.
- **CelesTrak rate limits / outage:** 2h server cache + stale fallback already implemented; never poll per-client faster than the cache TTL.
- **Antimeridian seams** on the track line: split features at ±180° (handled in `render.ts`).
- **Geolocation denied:** pass-prediction degrades to "unavailable", layer still works.
- **ToS:** CelesTrak and Esri are free for this use; keep attribution in the footer ticker.

## 7. Acceptance criteria
- [ ] Satellites render as classified `sat-*` icons on the MapLibre globe and revolve smoothly (no per-poll jumps).
- [ ] Layer toggle + per-group sub-toggles work with live counts; `S` toggles the layer.
- [ ] Clicking a satellite opens the dossier with NORAD id, altitude, velocity, period, and ground imagery (proxied).
- [ ] Selected satellite shows a continuous ground-track line with no antimeridian gash.
- [ ] Dossier shows an OVERHEAD pill and a next-pass time (AOS/LOS) when geolocation is granted; a clear fallback when denied.
- [ ] ISS (NORAD 25544) appears, classified as a station, with altitude ≈ 400–430 km.
- [ ] CelesTrak outage leaves the layer cleanly off with a ticker note (no crash); no raw outbound URL ever reaches the client.
- [ ] `passes.ts` and `render.ts` are pure and unit-tested (next-pass against a known ISS TLE; antimeridian split).

## 8. Out of scope / future
3D orbital shells / true-altitude extrusion; full `active` 11k catalogue by default; collision/conjunction analysis; satellite imagery tasking; historical orbit replay; push notifications for ISS passes; ground-station link budgets.
