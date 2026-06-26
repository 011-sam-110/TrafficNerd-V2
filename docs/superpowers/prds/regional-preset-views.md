# PRD: Regional preset views
> Priority: P2 · Effort: S · Status: Proposed · Category: map-interaction

## 1. Summary
Add a small set of one-click **preset views** that fly the single MapLibre globe to predefined transport regions of interest. Selecting a preset animates the camera (spinning-globe → flat-map) to a stored bounding box or center/zoom, so a first-time visitor who lands on London immediately discovers California, Finland, the world's busiest airspace, and key shipping straits. Presets are static config — no new network calls — and surface in both the left layer rail and the Ctrl/Cmd-K command palette.

## 2. Why it matters for TrafficNerd
The map opens on one region; ~3,300 cameras plus live planes/satellites are invisible until the user pans/zooms by hand. Presets turn "where is there anything to look at?" into a single click. They are transport-framed, not generic continents: they jump straight to live **camera source clusters** (TfL/Caltrans/SCDOT/Digitraffic) and to **aircraft/maritime** hotspots (busiest airspace, major straits), which is exactly the demo path that shows off all three layers fast — core to the zero-friction, instant-load ops-console feel.

## 3. worldmonitor.app reference
worldmonitor offers 8 fixed presets (Global, Americas, Europe, MENA, Asia, Latin America, Africa, Oceania); clicking one animates the map to that bounding region. We emulate the **interaction** (named buttons → animated fly-to) but replace continent buckets with transport-relevant destinations tied to our actual data.

## 4. How we build it (TrafficNerd-specific)
**Data source:** none external — presets are hardcoded config. This replaces the existing react-globe.gl `RegionView` (`{lat,lng,altitude}`) with a MapLibre-native shape.

**Add `lib/geo/presets.ts`** — single source of truth:
```ts
export type Preset = {
  id: string; label: string; group: "Cameras" | "Aircraft" | "Maritime" | "Global";
  // prefer a bbox so MapLibre fitBounds frames the cluster on any viewport
  bounds?: [[number, number], [number, number]]; // [[w,s],[e,n]]
  center?: [number, number]; zoom?: number;       // fallback for points
  icon?: IconKey;
};
```
Seed: **Global** (zoom 0, projection stays globe); **London (TfL)**, **California (Caltrans)**, **South Carolina (SCDOT)**, **Finland (Digitraffic)** — bounds derived from each source's camera extent (reuse the lat/lon already in `CAMERA_REGIONS`); **Busiest airspace** (London↔Amsterdam / NE-US corridor bbox); **Major straits** (Dover, Gibraltar, Malacca, Bosphorus — ship as individual point presets under the Maritime group). Counts shown next to camera presets come from the existing per-source counts (`counts[source]`).

**MapLibre integration (`components/MapView.tsx`):** add an imperative `flyToPreset(p)` that calls `map.fitBounds(p.bounds, { padding: 64, duration: 1400, essential: true })` or `map.flyTo({ center, zoom, duration: 1400 })`. MapLibre's globe projection handles the globe→flat transition automatically across the zoom range, so no separate "altitude" math is needed. Respect `prefers-reduced-motion` by setting `duration: 0`.

**Rework `components/RegionJump.tsx` → `components/PresetViews.tsx`:** dark glass panel grouped by `group`, live count badge for camera presets, hover ring in the source color, keyboard focusable. Hide camera presets whose `counts[source] === 0` (stale-cache empty); Aircraft/Maritime presets always show. Wire selection into the existing **command palette** (Cmd-K) as "Fly to …" entries so power users skip the panel.

**State:** no new store needed — `MapView` already exposes the map ref; pass `onJump` down exactly as `RegionJump` does today. Optionally write the last preset id to a tiny `presetStore` (useSyncExternalStore) so a "back to where I was" affordance and deep-linkable `?view=london` query param become trivial later.

**SSRF/proxy:** none — purely client-side camera moves, no cross-origin fetch.

## 5. Dependencies & prerequisites
- The MapLibre rebuild (single-instance globe engine) must be the live renderer — this PRD targets `MapView`, not the legacy `GlobeView`.
- Command palette feature (for the Cmd-K entries; panel works standalone if it lands first).
- Reuses `lib/icons/svg.ts` `CAMERA_REGIONS` data and the per-source `counts` already computed by the camera registry.

## 6. Risks & mitigations
- **Bounds drift** as new camera sources are added → derive camera-preset bounds from live extent in a build step, or keep the curated bbox list small and reviewed. **No rate limits / CORS / ToS concerns** (zero network). **Performance:** fitBounds may pull thousands of camera symbols into view at once — rely on the existing MapLibre symbol layer clustering/decluttering; do not render off-screen detail. **Reduced-motion / motion sickness** on long flies → cap `duration`, honor `prefers-reduced-motion`.

## 7. Acceptance criteria
- [ ] `lib/geo/presets.ts` exports a typed `Preset[]` covering Global + 4 camera regions + Busiest airspace + ≥3 straits.
- [ ] A grouped dark panel renders presets with live count badges; camera presets with 0 cameras are hidden.
- [ ] Clicking a preset animates the MapLibre map via `fitBounds`/`flyTo` and ends framing the intended region.
- [ ] Each preset is invocable from the Cmd-K palette.
- [ ] `prefers-reduced-motion` disables the animation (instant jump).
- [ ] No new outbound network requests are introduced (verified in network tab).
- [ ] Keyboard: panel buttons are tab-focusable and Enter-activatable.

## 8. Out of scope / future
Deep-linkable `?view=` URLs and shareable views; auto-derived bounds from live camera extent; user-saved custom presets; "tour" mode that cycles presets; satellite-pass or live-incident-driven dynamic presets.
