# TrafficNerd v2 — Live World design

**Date:** 2026-06-26
**Status:** Approved (3 design decisions confirmed by user) → in implementation
**Builds on:** P0 skeleton (night globe + TfL camera points + `/camera/[id]` page)

## Goal

Turn the static P0 globe into a **persistent live world**. The 3D globe is always the
background. Three layers of real-world objects sit on/around it — **cameras**,
**satellites**, **planes** — and clicking any of them opens a panel *over* the globe
(the globe keeps spinning behind it). Zooming in swaps the stylised globe for **real
satellite imagery**, with pins snapped exactly onto roads.

No API keys anywhere — every source below is open and was verified reachable on 2026-06-26.

## Verified data sources (no key)

| Layer | Endpoint | Returns |
|---|---|---|
| Cameras (exists) | `https://api.tfl.gov.uk/Place/Type/JamCam` | TfL JamCams lat/lon + imageUrl |
| Satellites | `https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json` (also `GROUP=stations` for ISS) | Orbital elements (MEAN_MOTION, INCLINATION, …) → propagate with `satellite.js` |
| Planes | `https://opensky-network.org/api/states/all?lamin=&lomin=&lamax=&lomax=` | Live state vectors: `[icao24, callsign, country, …, lon, lat, baro_alt, on_ground, velocity, true_track, vertical_rate, …, geo_alt, squawk, …]` |
| Zoom-in satellite map | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (Esri World Imagery) | Raster satellite basemap |
| Satellite "imagery" | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg` (NASA GIBS) | Daily true-colour Earth imagery |

Attribution is mandatory and already a project value: "Powered by TfL Open Data",
"Imagery © Esri", "NASA EOSDIS GIBS", "Data from CelesTrak", "Data from The OpenSky Network".

## Architecture

```
                    ┌──────────────── GlobeView (composition root, Agent A) ────────────────┐
 useCameras() ──────┤ pointsData = cameras (on surface)                                      │
 useSatellites() ───┤ objectsData = [...satellites, ...planes]  (altitude shell + cones)     │──▶ overlay.open(obj) on click
 usePlanes() ───────┤ when POV altitude < THRESHOLD → cross-fade to <MapView> (Esri tiles)   │
                    └──────────────────────────────────────────────────────────────────────┘
                                                   │
                         overlay store (lib/overlay.ts) ── useOverlay() ──▶ <FeedOverlay> renders <OverlayBody object=…/>
                                                                                         │
                                          overlay-content.tsx switches on kind ──▶ CameraDetail | SatelliteDetail | PlaneDetail
```

### Shared contracts (already created — DO NOT redefine)

- **`lib/world.ts`** — `WorldObject { kind, id, lat, lon, altKm?, heading?, label, color?, meta? }`.
  Every layer emits `WorldObject[]`. This is the only cross-layer type.
- **`lib/overlay.ts`** — `overlay.open(obj)` / `overlay.close()` / `useOverlay()`.
  One object open at a time. Globe stays mounted behind the panel.

### Rendering rules
- **Cameras**: `pointsData`, on the surface, **small** precise markers (`pointRadius ≈ 0.12`,
  `pointAltitude ≈ 0`). On the zoomed-in map they are exact `lng/lat` markers.
- **Planes**: `objectsData`, low altitude shell, cone/▲ oriented to `heading`.
- **Satellites**: `objectsData`, higher altitude shell (raw `altKm` compressed so LEO and
  GEO are both visible), small emissive marker; optional faint orbit ring.
- **Zoom→satellite map**: when the globe point-of-view altitude drops below a threshold,
  cross-fade into a `<MapView>` (MapLibre GL + Esri World Imagery raster) centred on the
  current focus; raise the POV back out to return to the globe. Pins render on the map at
  exact coordinates — this is what makes them "accurate".

### Pin accuracy (both rendering + data)
1. Rendering: shrink markers, drop the `0.025` altitude float to ~0, so they sit on the
   surface and don't parallax off the road at an angle.
2. Data audit: TfL coordinates are authoritative, but verify no lat/lon transposition or
   constant offset slipped in (`normalizeTfl`), and that markers land on the carriageway
   on the Esri map. Fix at the source adapter if a genuine offset exists.

### Satellite "click → imagery"
Clicking a satellite opens the overlay with: its identity (name, NORAD id, altitude,
velocity, orbital period) **and** a **satellite-imagery view of the ground directly beneath
it right now** (sub-satellite point) — NASA GIBS true-colour tile (or Esri) centred on that
lat/lon, with the ground footprint indicated. (ISS live external video can be added later —
out of scope for v1.)

## Work streams & file ownership (no two streams edit the same file concurrently)

**Deps pre-installed by orchestrator:** `maplibre-gl`, `satellite.js`, `@types/satellite.js`.
Do **not** run `npm install`, `npm run build`, or `next dev` (orchestrator owns the running
server + integration build). Only run your own unit tests: `npx vitest run <your test file>`.

- **Agent A — UI architecture & original 3 features**
  Owns: `components/GlobeView.tsx`, `components/FeedOverlay.tsx`, `components/MapView.tsx`,
  `components/CameraDetail.tsx`, `lib/overlay-content.tsx` (kind→component registry;
  implement `camera`, leave clearly-marked slots for `satellite`/`plane`),
  `app/globals.css`, `app/page.tsx`, camera-detail tests.
  Leaves an integration seam in GlobeView: `const objects: WorldObject[] = []; // INTEGRATION: satellites + planes`.
  Keep `/camera/[id]` page working as a deep-link fallback.

- **Agent C — planes layer**
  Owns: `lib/sources/opensky.ts`, `app/api/planes/route.ts`, `lib/planes/usePlanes.ts`
  (hook returning `WorldObject[]`), `components/PlaneDetail.tsx`, `tests/planes.*.test.ts`.
  Must NOT touch GlobeView/overlay-content (orchestrator wires PlaneDetail + plane objects in).

- **Orchestrator (me) — satellites layer + integration**
  Owns: `lib/sources/celestrak.ts`, `lib/satellites/propagate.ts`, `app/api/satellites/route.ts`,
  `lib/satellites/useSatellites.ts`, `components/SatelliteDetail.tsx`, `tests/satellites.*.test.ts`.
  Then integration: feed satellite + plane objects into GlobeView's seam, register
  SatelliteDetail/PlaneDetail in `overlay-content.tsx`, visual pass with design MCPs.

## Out of scope (YAGNI for v1)
- Multiple simultaneous feed windows (single overlay only; revisit later).
- Per-satellite custom 3D models, full orbit-trail history, time-scrubbing.
- Global plane coverage at all zooms (start with a sensible bbox / sampled set; OpenSky is
  rate-limited anonymously).

## Test plan
- Unit: `normalizeTfl` coords; satellite propagation against a known TLE/epoch (ISS sub-point
  sanity); OpenSky state-vector parse from a fixture; overlay store open/close.
- E2E (orchestrator, at integration): click camera → overlay image; zoom → map appears;
  click satellite → imagery; click plane → flight info.
