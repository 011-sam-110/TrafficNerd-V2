# Implementation Plan — TrafficNerd v2 redesign (light, single-globe)

> Branch `feat/redesign-light-globe`. Execution backbone for the overhaul. Roadmap detail lives in `../research/coordinator-notes.md` (§3 buckets, §4 cameras, §6 reconciliations); this file is the **execution sequence + orchestration + git + verification** contract.

## Locked decisions (from coordinator §7, confirmed by Sampo "lets build it")
1. **Identity:** calm / light / photographic / globe-as-hero / exploration tone. Keep shell *mechanics* (layer rail, dossier, freshness ticker, thin top bar, ⌘K, hidden-layer-doesn't-fetch, localStorage persistence); **drop** the dense dark panel-grid + neon identity. Dark = optional toggle later.
2. **Basemap:** CARTO Positron (light, keyless) default; OpenFreeMap fallback; Esri World Imagery for deep-zoom photographic payoff.
3. **Keys:** keyless camera path now (~20k cams). Windy (~70k webcams) + Sweden slot in when Sampo provides keys. Reddit creds → Prospector sweep folds into research later.
4. **Near-me / spatial search:** build as P1.
5. **Live-camera-thumbnail markers** at close zoom (LOD-gated).
6. **Count honesty:** freshness + honest per-region coverage; no "20k cameras" headline.
7. **v1 cut line:** ship P0 + P1 (+ slice of P2: presets, deep-links, persistent HLS player). Defer alerting, maritime-chokepoints, multiplatform.

## Execution milestones (each: build → verify → commit → push preview)
- **M1 — Engine spine** (`unified-globe-flat-map-engine`): single MapLibre `projection:'globe'` `WorldMap.tsx`; Positron light basemap + Esri deep-zoom; migrate existing camera/plane/trail layers; port satellites (SGP4 → GeoJSON sub-point layer, drop altitude shells); render WorldMap as the root; **remove `GlobeView.tsx` + react-globe.gl**; light baseline. Keep overlay/layers/cameraFilter stores working.
- **M2 — Calm console shell**: thin top status bar (counts + health badge), left layer rail (toggles + live counts + provenance cards), right slide-in dossier (shared section layout; the zoom payoff), bottom freshness ticker, ⌘K palette. Light, restrained, globe-hero. localStorage persistence + hidden-doesn't-fetch.
- **M3 — Live layers + payoff**: flight enrichment (adsbdb route origin/dest dots + airframe/photo in dossier), camera freshness (live→still→last-good→greyed + "updated/next" countdown), basic altitude-LOD + clustering to kill dot-soup.
- **M4 — Camera sources (parallel adapters)**: keyless tier per coordinator §4 — Castle Rock 511 (×9 systems), Oregon TripCheck, DriveBC, NZTA, Iceland, Estonia, Scotland. Each: adapter + unit test + captured fixture; wired into registry + SSRF allowlist; freshness-gated.
- **M5 — Near-me + search**: geolocate, "cameras near me," search-by-place, fly-there.
- **M6 — P2 slice + polish**: regional presets, shareable deep-links, persistent single HLS player; responsive/mobile sheets; honest coverage view.

## Orchestration model
- **Foundational / coherent cores** (M1 engine, M2 shell) → a single focused Opus agent each (or direct), tightly verified — not parallelized (shared core files).
- **Independent, additive work** (M4 camera adapters; later individual layers/components) → **parallel agent fan-out** (each owns its own new files; a serial integrate stage wires registry/allowlist).
- Agents verify with `tsc --noEmit` + targeted `vitest` only — **never `npm run build`** (concurrent builds corrupt `.next`). The authoritative `npm run build` is run once by the main loop per milestone, with the dev server stopped.
- Main loop reviews each agent milestone, runs the full gate, commits (solo-attributed, NO Claude trailer), pushes → Vercel preview.

## Verification gate (per milestone)
`npx tsc --noEmit` clean · `npx vitest run` green · `npm run build` green (dev stopped) · visual check on localhost. Then commit + push.

## Git
- Branch `feat/redesign-light-globe` off `feat/us-cameras`. One commit per milestone (or sub-step), descriptive, solo-attributed.
- Push at each green milestone for a Vercel preview deploy. Production (main) merge only on Sampo's say-so.

---

## Addenda — 2026-06-26 follow-ups

### Windy keys received (in `.env.local`, gitignored, server-side)
- `WINDY_WEBCAMS_API_KEY` → **Webcams layer** (~70k global webcams). Build as a **distinct "Webcams" sub-layer** (separate from road CCTV). Behind `/api/webcams` (server adds `x-windy-api-key`). Caveats: image URL token expires ~15 min (re-fetch list, don't cache), free tier low-res, **mandatory attribution** "Webcams provided by Windy.com" + per-image link back. → folds into **M4**.
- `WINDY_MAP_FORECAST_API_KEY` → **Weather layer** (`weather-natural-events-layer` PRD). Point/Map Forecast behind `/api/weather`. → **M6/P2**.
- `WINDY_PLUGINS_API_KEY` → embeddable Windy widgets; likely unused (own MapLibre map).

### OS-Maps-like / Outdoor capability (new — "I want the same features as OS Maps")
OS Maps = UK topo/outdoor maps + route planning (distance + **elevation profile**) + GPS locate + aerial toggle + 3D terrain + save/record routes. Reconcile with the global transport-monitor wedge by treating these as **additive modes/basemaps + an Explore panel**, not a pivot — they reinforce the "explore real places" exploration tone.
- **Basemap registry** (engine-level, **M1**): pluggable styles — Positron (light, default), Esri imagery (aerial), **Outdoor/Topo** (OpenTopoMap or topo vector, keyless, global), + optional genuine **OS "Outdoor"** style (UK only, needs free OS Data Hub key — see decision). Switcher UI in **M2** shell.
- **3D terrain + hillshade** (engine-level, **M1**): keyless DEM (AWS Terrarium `elevation-tiles-prod` terrain tiles) → MapLibre `raster-dem` + terrain + hillshade. Big "globe-as-hero" + OS-terrain win; serves the photographic identity.
- **GPS "locate me" + near-me** → already **M5** (P1); add geolocation + recenter.
- **Route planning + elevation profile** → new **M7 "Explore/Routes"** (P2/P3): draw a route, get distance + elevation profile, save/share. Keyless/free routing (OpenRouteService / GraphHopper free key, or OSRM) + elevation (open-elevation or DEM sampling). Flagged as a distinct sub-product dimension — confirm priority.
- **DECISION (OS branding):** genuine OS Explorer/Outdoor UK maps need a free **OS Data Hub** API key (GB-only, free tier). Default plan ships **OS-Maps-LIKE** features globally with keyless sources; offer to wire the real OS key if Sampo wants the authentic OS look for the UK.
- Grounding: an **OS-Maps/topo/terrain/routing source-research agent** runs (like the camera-sources sweep) to verify endpoints/keys before building → writes `../research/outdoor-sources.md`.

### Updated milestone notes
- **M1** now also: basemap registry + 3D terrain/hillshade (keyless DEM).
- **M4** now also: Windy Webcams sub-layer (`/api/webcams`, attribution).
- **M7 (new)**: Explore/Routes (route planning + elevation) — OS-Maps-distinctive.
