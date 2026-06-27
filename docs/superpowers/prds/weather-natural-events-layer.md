# PRD: Weather & natural-events layer
> Priority: P2 · Effort: L · Status: Proposed · Category: data-layer

## 1. Summary
Add three toggleable layers to TrafficNerd v2's single MapLibre globe that show the conditions transport actually has to deal with: **Weather alerts** (NWS severe-weather polygons), **Weather radar** (a global, animated precipitation raster), and **Natural hazards** (USGS M4.5+ earthquakes + NASA EONET events — wildfires, storms, volcanoes, sea/lake ice). Quakes and EONET events become clickable `hazard` WorldObjects that open the existing dossier; new ones trigger an activity pulse. All sources are keyless and fetched server-side through the SSRF allowlist.

## 2. Why it matters for TrafficNerd
Weather and natural hazards are the dominant disruptors of the things TrafficNerd already watches: storms ground aircraft and close airspace, fog blinds the camera grid, quakes and wildfires shut roads and trigger diversions, and tropical systems reroute shipping (pairs with the maritime-ais-vessels layer). Overlaying a storm cell on top of live cameras and planes turns a pile of dots into *situational awareness* — "why is every JamCam near this front showing standstill traffic, and why are these flights holding?" It directly extends the "weather-cam" angle: see the storm, then watch it on the ground.

## 3. worldmonitor.app reference
worldmonitor ships a **Weather** layer (NWS severe warnings), a **Natural** layer (USGS M4.5+ quakes + NASA EONET), a **Fires** layer (NASA FIRMS), and **Climate Anomalies** (ERA5 zones), and flashes an activity highlight when a new quake/EONET event lands. We emulate the warning polygons + quake/EONET points + new-event highlight, and **add an animated radar raster** (worldmonitor's killer "see the storm move" view). We drop FIRMS for v1 (needs a free MAP_KEY — not keyless) and defer the 15-zone ERA5 climate layer.

## 4. How we build it (TrafficNerd-specific)

**Data sources (keyless).**
- **NWS alerts:** `api.weather.gov/alerts/active` (GeoJSON polygons; requires a `User-Agent` header → must be server-side). US only for v1.
- **Earthquakes:** USGS `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson`.
- **EONET events:** `eonet.gsfc.nasa.gov/api/v3/events?status=open` (wildfires, severeStorms, volcanoes, seaLakeIce).
- **Radar:** RainViewer `api.rainviewer.com/public/weather-maps.json` → per-frame tile template `…/v2/radar/{ts}/256/{z}/{x}/{y}/2/1_1.png` (global, keyless).

**Server routes (SSRF-safe, with cache + stale fallback like `lib/sources/celestrak.ts`).** Add `app/api/weather/alerts/route.ts` (NWS, injects UA, 60s cache), `app/api/hazards/route.ts` (merges USGS + EONET via `Promise.allSettled` → normalized GeoJSON, 2–5min cache), `app/api/weather/radar/route.ts` (returns RainViewer frame list + timestamps). Radar PNG tiles are pulled through the existing `/api/proxy` image proxy; add `api.weather.gov`, `earthquake.usgs.gov`, `eonet.gsfc.nasa.gov`, and `tilecache.rainviewer.com` to `lib/proxy/allowlist.ts`. The client never sees a raw tile URL — the MapLibre raster source points at `/api/proxy?url=…` (or a dedicated `/api/weather/tiles/{z}/{x}/{y}` passthrough).

**MapLibre layers (mutate source data, never re-add layers).**
- `weather-radar` raster source (tiles via proxy), `raster-opacity` ~0.5, sits below symbol layers; frame index advances on a 0.5s tick for the loop.
- `weather-alerts-fill` + `-line`: fill colored by `["match", ["get","severity"], "Extreme", …]` from NWS `properties.severity`, ~0.25 opacity, click queries `queryRenderedFeatures`.
- `hazards-symbols`: `icon-image` by `["get","hazardType"]`; quakes also get a `hazards-quake-circle` layer with `circle-radius` interpolated on `["get","mag"]`. A `["get","isNew"]` flag drives a pulsing circle for events seen in the last poll.

**Files to ADD:** `lib/hazards/useHazards.ts`, `lib/hazards/classify.ts`, `lib/hazards/render.ts` (→GeoJSON, antimeridian-safe), `lib/weather/useWeatherAlerts.ts`, `lib/weather/radar.ts`, `components/HazardLayer.tsx`, `components/WeatherLayer.tsx`, `components/HazardDetail.tsx`, `components/WeatherAlertDetail.tsx`. **CHANGE:** `lib/world.ts` (add `"hazard"` to `WorldObjectKind`), `lib/layers.ts` (add `weatherAlerts`, `weatherRadar`, `hazards` keys + quake/fire/event sub-toggles, default radar **off**), `components/LayerControl.tsx`, `components/FeedOverlay.tsx` (route `hazard` kind to `HazardDetail`), `lib/icons/svg.ts` (quake/fire/volcano/storm icons), `lib/proxy/allowlist.ts`.

**UX.** Layer rail toggles with live counts ("12 quakes · 8 fires · 3 storms"). Click a quake/EONET marker → dossier with magnitude/depth/time + a USGS/EONET source link, plus a "cameras within 50 km" hint. Click an alert polygon → headline, severity pill, expiry, area. Radar shows a play/pause + timestamp scrubber. Loading = skeleton counts; any source failure leaves that layer cleanly off with a freshness-ticker note (routes return empty collections on error). Keyboard: `W` toggles weather, `H` toggles hazards, Esc closes the dossier.

## 5. Dependencies & prerequisites
- `unified-globe-flat-map-engine` (MapLibre shell + image registration), `left-layer-rail` (toggles/counts), `dark-ops-console-shell` + `data-freshness-ticker` (status/error surfacing), shared `WorldObject`/`overlay`/`layers` stores, and the existing `/api/proxy` + `lib/proxy/allowlist.ts`. No new runtime deps.

## 6. Risks & mitigations
- **Rate limits / ToS:** NWS requires a descriptive `User-Agent`; USGS/EONET/RainViewer ask for sane polling — server-cache (60s alerts, 2–5min hazards, 5min radar) and never poll per-client. Keep attribution in the footer.
- **Coverage gap:** NWS is US-only; label the layer "Severe weather (US)" and note Meteoalarm (EU) as future, not a silent global claim.
- **Perf:** alert polygons can be large/many — simplify server-side and cap radar to ~10 frames; raster + a few hundred hazard points add negligible load over the camera/plane layers.
- **CORS/SSRF:** every source goes through allowlisted server routes/proxy; redirect:'error', `AbortSignal.timeout` reused.

## 7. Acceptance criteria
- [ ] Three independent toggles (Weather alerts / Radar / Hazards) with live counts; `W` and `H` shortcuts work.
- [ ] NWS alert polygons render colored by severity; clicking one opens the alert dossier with headline + expiry.
- [ ] USGS M4.5+ quakes render as magnitude-scaled circles; EONET fires/storms/volcanoes render with type icons; clicking opens the dossier.
- [ ] Radar raster loops with a play/pause + timestamp; defaults off.
- [ ] A newly-arrived quake/event pulses for one poll cycle.
- [ ] Any source outage leaves its layer cleanly off with a ticker note; no crash; no raw tile/source URL reaches the client.
- [ ] `classify.ts` / `render.ts` are pure and unit-tested (USGS+EONET merge, antimeridian split, new-event diff).

## 8. Out of scope / future
NASA FIRMS fire detections (needs a free MAP_KEY), ERA5 climate-anomaly zones, Meteoalarm/EU + global non-US warnings, lightning, marine/aviation-specific products (METAR/SIGMET), historical replay, and per-object weather push alerts.
