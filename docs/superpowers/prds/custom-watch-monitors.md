# PRD: Custom watch monitors (keyword/entity)
> Priority: P2 · Effort: M · Status: Proposed · Category: alerting

## 1. Summary
Let users define named "watches" — a tail number, callsign, aircraft type, NORAD id, camera name, road, or free-text — each auto-assigned a unique colour. Any `WorldObject` matching a watch gets that colour on the globe/map plus a coloured badge in its dossier, and the watch appears in a left-rail "Watches" group with a live match count and a quick-jump-to-match action. Watches persist in `localStorage`. Outcome: a cheap, keyless, high-perceived-value alerting layer that turns the dense feed into a personal radar — "tell me when G-EZUK or any Starlink is on screen."

## 2. Why it matters for TrafficNerd
The map shows 3,300+ cameras and hundreds of planes/satellites at once; finding *your* object is hopeless by eye. Plane-spotters track a specific airframe, ops viewers watch one motorway's cameras, orbital fans follow the ISS (NORAD 25544). Watches make every entity searchable, colour-coded and jump-to-able without any backend, login, or polling — pure client logic over data we already stream.

## 3. worldmonitor.app reference
worldmonitor's "Custom Monitors": type comma-separated keywords, the system assigns each a unique colour and auto-highlights matching articles/clusters in the feed, all persisted in `localStorage`. We adapt the *mechanic* (named term → unique colour → live highlight → persistence) but match against structured transport entities instead of news text.

## 4. How we build it (TrafficNerd-specific)
**Data sources:** none new. Watches are pure client-side predicates over the existing `WorldObject[]` already produced by the camera registry, adsb.lol/adsbdb planes, and CelesTrak satellites. No outbound fetch, so no proxy/SSRF surface is touched.

**Store (the core):** add `lib/watches.ts` — same framework-light `useSyncExternalStore` pattern as `lib/layers.ts`/`lib/overlay.ts`:
```ts
export type WatchField = "any" | "callsign" | "tail" | "type" | "norad" | "camera" | "road";
export interface Watch { id: string; term: string; field: WatchField; color: string; enabled: boolean; }
```
The store exposes `add/remove/toggle/setTerm`, hydrates from `localStorage["tn.watches.v1"]` on first read, and writes back on every mutation (guarded for SSR — only touch `window` in `useEffect`/lazy init). Colours come from a fixed 12-entry palette, assigned round-robin so each watch is visually distinct.

**Matching:** add `lib/watchMatch.ts` exporting `matchWatch(obj: WorldObject, w: Watch): boolean`. It reads the structured fields the layers already populate: `obj.label`, `obj.typeLabel`, and `obj.meta` (`callsign`, registration/`tail`, `noradId`, `road`). `field:"any"` does a case-insensitive substring over label + typeLabel + stringified meta values; specific fields scope to one key. A memoized selector `matchedWatch(obj): Watch | null` returns the first enabled match (deterministic by watch order).

**Render (reuse the single instance):** `GlobeView` already maps `WorldObject → color/icon`. Inject `matchedWatch(obj)?.color` so a match overrides the layer palette; in MapLibre this is a `case` colour expression keyed on a per-feature `watchColor` property set when building feature collections (no new source/layer — just an extra `properties.watchColor` and a halo via `circle-stroke-color`/`circle-stroke-width: 3`). Non-matches keep their normal palette.

**Components:** add `components/WatchPanel.tsx` (add-watch input with a field dropdown, chip list with colour swatch, count badge, enable toggle, delete, "jump to first match" that pans the globe to `obj.lat/lon`). It mounts inside the existing left layer rail as a collapsible "Watches" group. `components/FeedOverlay.tsx`/`CameraDetail`/`PlaneDetail`/`SatelliteDetail` get a small coloured "Watched: <term>" badge when the open object matches.

**Files — ADD:** `lib/watches.ts`, `lib/watchMatch.ts`, `lib/watchPalette.ts`, `components/WatchPanel.tsx`. **CHANGE:** `components/GlobeView.tsx` + `components/MapView.tsx` (apply `watchColor` + halo), `components/LayerControl.tsx` (host the Watches group), the four `*Detail`/`FeedOverlay` components (badge).

**UX/states:** instant, synchronous. Empty → "No watches yet. Add a tail number, callsign, type, or NORAD id." Match count of 0 → greyed chip reading "no live matches". Duplicate term → focus the existing chip. Keyboard: `Enter` adds, `Esc` clears the input, watch group is part of the `Ctrl/Cmd-K` palette ("Add watch…"). `prefers-reduced-motion` respected by the existing jump animation.

**SSRF/proxy:** unchanged — watches never fetch; the client still only ever sees proxied media via `/api/proxy` and `/api/hls`.

## 5. Dependencies & prerequisites
- `lib/world.ts` `WorldObject` (present) — relies on layers populating `meta.callsign`, registration, `noradId`, `road`.
- Single-MapLibre engine (unified-globe-flat-map-engine) as the active render path for the colour expression.
- Left rail (left-layer-rail) to host the Watches group; degrades to a standalone panel if not yet built.
- No new npm deps.

## 6. Risks & mitigations
- **Re-match cost at scale (thousands of features × N watches):** memoize per render tick; cap watches at 12 (palette size); short-circuit on first match. Matching is O(features × enabledWatches) once per data tick, not per frame.
- **localStorage quota / corruption:** versioned key (`v1`), `try/catch` parse with reset-to-empty fallback.
- **Stale meta fields:** some camera sources lack `road`; `field:"any"` always works as a fallback and field dropdown only offers fields present in the active layers.
- **CORS/ToS:** none — no network calls added.
- **Colour clash with layer palette:** watch halo (stroke) plus fill override keeps matches legible against both camera/plane/sat palettes.

## 7. Acceptance criteria
- [ ] Adding "25544" (NORAD, ISS) colours the ISS marker and shows count `1` on its chip.
- [ ] Adding a callsign currently airborne highlights that plane and badges its dossier.
- [ ] Watches survive a page reload (localStorage).
- [ ] Disabling a watch removes its highlight without deleting it; deleting frees its colour.
- [ ] "Jump to first match" pans/zooms the globe to the matched object.
- [ ] ≥2 simultaneous watches render with distinct colours; non-matches keep normal palette.
- [ ] No new outbound origins; media still routed through `/api/proxy` and `/api/hls`.
- [ ] Zero-match and empty states render the documented copy; `Enter`/`Esc` work.

## 8. Out of scope / future
- Push/sound notifications or "alert when a watch *enters* view" (deferred — needs a diff/event loop).
- Server-side or cross-device sync of watches (keyless, no-signup constraint).
- MMSI/vessel-name watches (depend on the maritime-ais-vessels layer; the `field` enum reserves space).
- Regex / boolean queries and saved watch *sets* beyond the flat localStorage list.
- Geofence watches ("any plane below 2000ft over London").
