# PRD: Left layer rail with toggles, counts & explainer cards
> Priority: P1 · Effort: M · Status: Proposed · Category: ui-shell

## 1. Summary
Promote today's floating `LayerControl` legend into the canonical left layer rail of the worldmonitor-style ops console: a docked, persistent panel that lists every world layer (Cameras, Planes, Satellites, plus future Ships/Weather) with an on/off toggle, a live tabular-numeric count, one-click presets ("All", "None", "Cameras only", "Air + space"), and a per-layer provenance/explainer card stating purpose, data source, freshness, and limitations. State persists across reloads; on mobile it collapses to a curated bottom sheet.

## 2. Why it matters for TrafficNerd
The rail is how a user composes their view of the moving world. Watching SoCal freeways means Cameras-only over Caltrans+SCDOT; tracking transatlantic traffic means Air+space with cameras off. Live counts ("3,312 cameras · 487 planes · 92 sats") are the at-a-glance pulse of the feed, and the explainer card answers the recruiter-grade question "where does this number come from and how fresh is it?" — turning an opaque map into an auditable instrument.

## 3. worldmonitor.app reference
worldmonitor's left panel toggles any of ~56 layers grouped by category, ships presets (Military/Finance/Intel/All/None/Minimal), and gives each layer a compact "Layer Explanation" card (purpose, source, freshness, confidence, limitations). We adopt the toggle+count+preset+explainer pattern, scaled down to TrafficNerd's handful of transport layers and grouped by domain (Ground / Air / Space).

## 4. How we build it (TrafficNerd-specific)
**Sources (all keyless, already wired):** counts come from the live render arrays in `GlobeView` (`pts.length`, `planesLayer.objects.length`, `satellites.length`) passed via the existing `counts` prop (GlobeView.tsx:232). Provenance metadata is static, sourced from the adapters in `lib/sources/` (TfL, Caltrans `cwwp2.dot.ca.gov`, SCDOT `511sc.org`, Digitraffic `tie.digitraffic.fi`, planes `api.adsb.lol`, satellites `celestrak.org`).

**State / stores (reuse the `useSyncExternalStore` pattern):**
- Extend `lib/layers.ts` — add `ships` and `weather` to `LayerKey`/`LayerState` (default `false` until those layers ship), and add `layersStore.applyPreset(name)` + an `applyAll(on)` helper.
- ADD `lib/layerMeta.ts` — single source of truth: `{ key, name, group, accent, sources: SourceMeta[], purpose, freshness, limitations }`. `SourceMeta` = `{ id, label, endpointHost, refreshSeconds, attribution }`, mirroring `cameraFilter` region ids (`tfl|caltrans|scdot|digitraffic`).
- ADD `lib/persist.ts` — tiny `localStorage` hydrate/save (key `tn.layers.v1` + `tn.cameraFilter.v1`), guarded for SSR (`typeof window`), wired into both stores on init and on `emit()`.
- ADD `lib/presets.ts` — `PRESETS: { id, label, layers: Partial<LayerState> }[]` for All / None / Cameras only / Air + space.

**Components:**
- RENAME/refactor `components/LayerControl.tsx` → `components/LayerRail.tsx`: docked rail (`position:fixed; top/left/bottom` with internal scroll), keeping the existing per-row toggle + count + expandable type-key, plus a new preset button strip at top and a per-row "info" affordance opening the explainer card (`<LayerExplainer meta={...}/>`).
- ADD `components/LayerExplainer.tsx` — the provenance card (purpose, source chips, "updates every Ns", limitations).
- ADD `components/LayerRailMobile.tsx` — collapsed bottom sheet (curated: Cameras/Planes/Satellites) under a `@media (max-width:768px)` switch.
- CHANGE `app/page.tsx` / `GlobeView.tsx` mount point to render `LayerRail` (keep the `counts` prop contract).

**UX:** rows show accent dot + name + count + switch; preset click animates affected switches; counts show `—` while sources load and `0` (dimmed) when empty; a per-layer error badge appears if its source array is empty due to `Promise.allSettled` rejection (registry already falls back to stale cache). Keyboard: rail is a `role="group"`, each toggle a real `<button>` with `aria-pressed`; presets reachable by Tab; `L` focuses the rail. Camera sub-filters (region chips, live-only) stay nested under the Cameras row via existing `cameraFilterStore`.

**SSRF:** none added — the rail consumes already-fetched counts and renders static metadata. It never holds or displays a raw `streamUrl`; any thumbnail in an explainer goes through `/api/proxy`.

## 5. Dependencies & prerequisites
- Existing stores `lib/layers.ts`, `lib/cameraFilter.ts`, `lib/overlay.ts`; the source registry (`lib/sources/registry.ts`).
- Soft-depends on `ships` / `weather` layer PRDs for those rows to become active (rendered disabled until then).
- No new npm packages.

## 6. Risks & mitigations
- **Count churn / re-render storms** at hundreds of planes: counts already derive from memoized arrays in GlobeView; rail subscribes once via `useSyncExternalStore`, so toggling is O(layers), not O(objects).
- **localStorage hydration flash / SSR mismatch:** rail is inside the `ssr:false` dynamic `GlobeView`; hydrate in `useEffect` and gate first paint on a `hydrated` flag.
- **Misleading freshness claims (ToS/honesty):** `refreshSeconds` in `layerMeta` must match each adapter's real cadence; reviewer cross-checks against `lib/sources/*`.
- **Disabled future layers confusing users:** show "coming soon" state, not a dead toggle.

## 7. Acceptance criteria
- [ ] Docked left rail lists Cameras/Planes/Satellites (Ships/Weather shown disabled) grouped Ground/Air/Space.
- [ ] Each row shows a live count matching the rendered marker count.
- [ ] Toggling a row hides/shows that layer on the MapLibre/globe view.
- [ ] Presets All / None / Cameras only / Air + space set the correct combination in one click.
- [ ] Each layer has an explainer card with purpose, named source(s), update cadence, and limitations.
- [ ] Layer + camera-filter state survives a page reload (localStorage), no SSR hydration warning.
- [ ] Fully keyboard-operable; all toggles expose `aria-pressed`.
- [ ] On ≤768px width the rail collapses to a curated bottom sheet.
- [ ] No raw `streamUrl` is ever exposed by the rail.

## 8. Out of scope / future
Per-layer opacity/style controls; saving custom user presets; the Ships and Weather data layers themselves (separate PRDs); search-within-rail; drag-to-reorder; command-palette wiring (separate Ctrl/Cmd-K PRD, which will call `layersStore.applyPreset`).
