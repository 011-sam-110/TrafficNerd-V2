# PRD: Unified globe-to-flat map engine
> Priority: P0 · Effort: L · Status: Proposed · Category: map-interaction

## 1. Summary
Collapse TrafficNerd's current two-engine renderer (react-globe.gl for the 3D globe in `GlobeView.tsx` + MapLibre raster map in `MapView.tsx`, cross-faded by altitude) into a **single MapLibre GL JS v5 instance** using `projection: 'globe'`. One canvas renders a spinning 3D globe when zoomed out and a flat street/satellite map when zoomed in, with MapLibre auto-morphing globe→mercator across the zoom range. This removes the cross-fade seam, halves the WebGL contexts/asset pipelines, and gives true Google-Earth-style continuous zoom. All world objects (cameras, planes, satellites) become MapLibre symbol/GeoJSON layers on this one map.

## 2. Why it matters for TrafficNerd
The product promise is "one interactive world map" for transport. Today the user crosses a visible cross-fade boundary and loses object continuity. A unified engine means: smoothly fly from a global view of ~3,300 cameras + hundreds of planes down to a single London carriageway camera without a context switch; pins stay pixel-accurate on the real road (MapLibre's geographic projection, not a stylised globe); and overlays (borders, satellite imagery, day/night) render identically at every zoom. It is the foundational shell every other layer PRD builds on.

## 3. worldmonitor.app reference
worldmonitor runs **two** engines — globe.gl/Three.js for the 3D globe and deck.gl/MapLibre for the flat map with 56 layer types — switching between them. We emulate the *experience* (continuous zoom, layer toggles, overlays like the solar terminator and country boundaries) but reject the dual-engine implementation: MapLibre v5 globe projection gives us the morph natively in one engine.

## 4. How we build it (TrafficNerd-specific)
**Data sources:** No new external data. Basemap = keyless CARTO dark-matter vector tiles (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`, OSM-derived). Satellite-imagery layer = Esri World Imagery raster (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`, already used in `MapView.tsx`). Country borders = bundled admin-0 GeoJSON in `public/geo/admin0.json`.

**Engine component (ADD `components/WorldMap.tsx`):** owns one `maplibregl.Map` with `style` = CARTO dark, `projection: { type: 'globe' }`, `maxZoom: 18`, `renderWorldCopies: false`. Replaces both `GlobeView.tsx` and `MapView.tsx`. Auto-rotate when idle and zoom < 3 (rAF nudging `map.setBearing`), cancel on user interaction.

**Layers:** keep the existing GeoJSON-source pattern from `MapView.tsx`:
- `cameras` — symbol layer, icons from `lib/icons/svg.ts` registered via `map.addImage`, region color from `cameraRegionColor`. Cluster below zoom 5 (`cluster: true`, `clusterRadius: 50`) so 3,300 points stay performant on the globe.
- `planes` / `plane-markers` + `trails` / `trail-lines` — reuse `toPlaneFC`/`toTrailFC`; `icon-rotate: ['get','heading']`.
- `satellites` — symbol layer; since MapLibre is 2D-on-globe (no altitude shell), retire `lib/altitude.ts` shell mapping and instead encode altitude as a label/badge in the dossier; plot satellites at sub-point lat/lon.

**Overlays (ADD to `lib/overlay.ts` companion `lib/layers.ts`):** extend `LayerKey` with `borders` and `satelliteImagery`; both are raster/line layers toggled via `map.setLayoutProperty(id,'visibility',…)`. (Day/night terminator is a separate PRD; this engine just reserves a `terminator` fill layer slot.)

**Stores/UX:** `layersStore` (existing) drives `<LayerControl>` toggles + live counts. Click → `overlay.set(worldObject)` opens the right dossier (`CameraDetail`/`PlaneDetail`/`SatelliteDetail`). States: loading skeleton over canvas until first tiles + first registry response; empty = "No live objects in view"; error = stale-cache banner. Keyboard: `+`/`-` zoom, arrows pan, `Esc` closes dossier, `R` resets to globe view.

**CHANGE:** `app/page.tsx` renders `WorldMap` (dynamic, `ssr:false`) instead of `GlobeView`; delete `GlobeView.tsx`/`MapView.tsx` after parity.

**SSRF:** unchanged — camera media still flows through `/api/proxy` and `/api/hls`; the client never receives a raw `streamUrl`. Basemap/imagery/CARTO hosts are public CDNs hit directly by MapLibre (no secrets, no proxy needed); add them to the CSP `connect-src`/`img-src` allowlist.

## 5. Dependencies & prerequisites
- `maplibre-gl@^5.24` (already installed; v5 required for `projection:'globe'`).
- Existing building blocks: `lib/icons/svg.ts`, `lib/world.ts` `WorldObject`, `lib/overlay.ts`, `lib/layers.ts`, camera registry, `/api/proxy`, `/api/hls`.
- Soft-blocks the `day-night-terminator` and `country-borders-overlay` PRDs (they layer onto this engine).

## 6. Risks & mitigations
- **Perf at 3,300+ points on globe:** use clustering + `symbol-sort-key`; cap planes layer to viewport bbox. Mitigate label thrash by disabling `text-field` below zoom 4.
- **Globe projection quirks (v5):** terminator/great-circle arcs can clip at the antimeridian — test explicitly; pin MapLibre version.
- **One WebGL context loss kills everything:** add `webglcontextlost` handler that re-inits the map and re-adds layers from the stores.
- **Tile CDN rate limits/ToS:** CARTO + Esri are keyless but ToS-bound; show attribution (`AttributionBadge.tsx`) and cache tiles via browser; no scraping.
- **No CORS issue** for tiles (CDNs send `*`); media stays proxied.

## 7. Acceptance criteria
- [ ] Single `maplibregl.Map` instance; `GlobeView.tsx` and `MapView.tsx` removed.
- [ ] Continuous zoom from spinning globe (z0–2) to flat street/satellite map (z14+) with no cross-fade seam, sustained ≥30fps on a mid laptop.
- [ ] Cameras, planes (rotated + trails), satellites all render as MapLibre layers and survive zoom/projection morph; clusters split correctly when zooming in.
- [ ] `<LayerControl>` toggles cameras/planes/satellites/borders/satelliteImagery with live counts; idle auto-rotate engages and cancels on interaction.
- [ ] Click opens correct dossier; `Esc`/`R` keyboard work; loading/empty/error states render.
- [ ] No raw `streamUrl` reaches the client; CSP allowlists CARTO/Esri; attribution shown.
- [ ] WebGL context-loss recovery re-renders all layers.

## 8. Out of scope / future
Day/night solar terminator, country-borders dataset sourcing, trade-route/great-circle arcs, deck.gl-style heatmaps, map pinning/split-view, 3D terrain/buildings, and offline tile caching — each its own PRD layering onto this engine.
