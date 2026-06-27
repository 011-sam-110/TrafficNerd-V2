# SP2 · Widgetize Everything — Workspace, Source Catalog & Video Wall — Design Spec

> Date: 2026-06-27 · Status: Draft · Owner: Sampo
> Part of the TrafficNerd V2 **UI overhaul**. Consumes SP1 (`2026-06-27-variant-spine-design.md`):
> reuses the `Variant` model, the reserved `variantStore.layoutOverrides` seam, `PanelPlacement.grid`,
> and the signals registry/store/freshness trio. This is the big follow-on that turns the
> calm fixed-panel shell into a fully widgetized, worldmonitor-grade monitoring console.
> Grounded in three parallel design reviews (worldmonitor study + dashboard-UX critique +
> in-codebase feasibility) run 2026-06-27.

## 0. Where this sits

The UI overhaul = one foundation (SP1, shipped) + feature modules that plug into it.
This spec covers the **widget workspace** module: the react-grid-layout dashboard, the
unified Source Catalog, the generic monitor-widget, and the combined Video widget. It is
deliberately large and is decomposed into phases (§12); only **Phase 1** is built first.

### 0.1 Decisions locked during brainstorming (2026-06-27)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Map ↔ widgets | **Map is ONE tile** in a true react-grid-layout grid; everything is tiled. Map is a *pinned, min-size, non-removable* hero tile. |
| D2 | Layers redesign | **Each source is a placeable widget.** One unified **Source Catalog** replaces the two split layer systems; each row has two orthogonal toggles: `◇ Map` and `▦ Widget`. |
| D3 | Widget granularity | **Category roll-ups (one per `group`) are the default unit.** Single-source leaf widgets exist but are born from a **pop-out drill-down**, never picked cold. |
| D4 | Video widget | **One combined widget**, tabbed: **News** + **Cameras**. News = **HLS-first via `/api/hls`**, **YouTube IFrame only as a per-channel fallback** for channels with no public HLS (Sky/Bloomberg/BBC). Cameras = HLS. One persistent `hls.js` engine drives both tabs (+ a scoped YouTube engine only when a fallback channel is selected). |
| D5 | Customization | **Full** drag / resize / add / remove / save named layouts / share via URL. Presets are starting points. |
| D6 | Phase 1 scope | **Source Catalog + monitor widgets** (with the minimal grid host they live in). |

### 0.2 Non-goals (this spec)

AI analyst chat, scenario/forecast engines, prediction markets, the "probe at point"
multi-source readout, the cross-source correlation tiles, and the GPX route widget are
**future modules** (noted in §13) that register into the seam this spec creates. We build
the framework + the core widget set, not every conceivable widget.

---

## 1. Goals & success criteria

**Goal:** a worldmonitor-grade situational-awareness console where every one of the ~53
live data sources can be surfaced as a draggable monitor widget, the map is one tile among
many, news and cameras play as live video, and the whole layout is user-composable,
persistent, and shareable — without sacrificing TrafficNerd's calm-light identity or its
"all media proxied / honest freshness" stance.

**Success criteria:**
1. A user can drag, resize, add, and remove widgets; the layout persists across reload and
   round-trips through a share URL.
2. The map renders as a resizable grid tile with no clipping/blur on resize, and cannot be
   accidentally removed.
3. All 53 sources appear in one searchable Source Catalog with an `X/Y enabled` counter;
   every source has independent `◇ Map` and `▦ Widget` toggles that mirror the same state
   everywhere it is shown.
4. A generic monitor widget renders any source (roll-up or leaf) with the standard anatomy
   (count, delta, severity, freshness, attribution) reading **existing** stores — adding a
   widget spawns **zero** new network pollers.
5. The Video widget plays live news (proxied HLS) and live cameras (proxied HLS) from one
   persistent player that survives grid re-layout and auto-pauses when hidden/idle.
6. Freshness is honest: loading / live / empty-healthy / stale / offline / rate-limited /
   key-gated-unset are visually distinct; roll-up freshness is worst-of, never averaged.
7. `npm run build` + lint + `vitest` green; solo-attributed commits; no regression to the
   existing globe, clustering, dossier, or deep-links.

---

## 2. Architecture overview

```
ConsoleShell  (owns hydration, ⌘K, dossier overlay)
 ├─ FeedHost            ← NEW: hoisted gating feeds; the ONLY place that polls.
 │    └─ per-source <Feed> mounted when (map layer on OR a widget for it is placed)
 ├─ PersistentPlayer    ← NEW: one hls.js (+ scoped YT) engine, portaled into the Video tile
 ├─ Workspace           ← NEW: ResponsiveGridLayout (rgl 2.2.3); draft layout in state,
 │    │                        commit-on-drop → variantStore.layoutOverrides
 │    ├─ WidgetHost(map)        → WorldMap (pinned, ResizeObserver→map.resize())
 │    ├─ WidgetHost(video)      → Video tile (PersistentPlayer portals in here)
 │    ├─ WidgetHost(rollup:*)   → SourceWidget (category)
 │    ├─ WidgetHost(source:*)   → SourceWidget (leaf, popped out)
 │    └─ WidgetHost(util:*)     → Brief / News / Markets / Watchlist / Coverage / Freshness / Clock
 ├─ SourceCatalog       ← NEW: evolves LayerRail; the one control surface + "add widget" tray
 └─ CommandPalette      ← extended: every source/widget/preset/time-range indexed
```

Data flow is unchanged at its core: `FeedHost` fetches → module-singleton stores
(`signalsStore`, `signalCountsStore`, `signalFreshnessStore`, `metricsStore`, the new
`signalDataStore`) → many subscribers (map layers, widgets, status bar) read. **N readers,
1 fetch.**

---

## 3. The unified Source Catalog (`lib/sources/catalog.ts`)

Today there are two disconnected systems: `lib/layers.ts` (6 bespoke core layers:
cameras/planes/satellites/webcams + planned ships/weather) and `lib/signals/*` (39 signals
behind one registry). Phase 1 unifies them behind one descriptor:

```ts
interface CatalogSource {
  id: string;                       // 'cameras' | 'planes' | 'earthquakes' | ...
  kind: 'core' | 'signal';
  label: string;
  group: string;                    // the roll-up key — REUSED from SignalSource.group
  color: string;
  attribution: string;              // mandatory; surfaced in every widget footer
  keyEnv?: string;                  // e.g. 'FIRMS_MAP_KEY' → drives key-gated state
  bodyKind?: 'events' | 'scalar' | 'series' | 'area';  // widget body renderer; default 'events'
  // live, read from existing stores (no new fetch):
  count$:  () => number;            // signalCountsStore | metricsStore
  fresh$:  () => Freshness;         // signalFreshnessStore | freshnessStore
  mapOn:   () => boolean;           // signalsStore | layersStore
  toggleMap: (on: boolean) => void;
}

export const SOURCE_CATALOG: CatalogSource[]  // = core descriptors ⊕ SIGNALS, in group order
export function catalogByGroup(): { group: string; sources: CatalogSource[] }[]
```

The catalog is **derived** from the existing registry + a small hand list of core layers —
not a hand-maintained parallel list. Adding a signal still means "one adapter + one registry
entry" (the existing contract); it now also appears in the catalog and as a widget for free.

**Two orthogonal toggles per row** (the §D2 resolution to "two control systems"):

```
┌ SOURCE CATALOG ───────────── search: "quake"  ─────  47 / 53 on ┐
│ HAZARDS  (roll-up)                              ◇ Map   ▦ Widget │
│   Earthquakes (USGS)        142  ●fresh         ◇ on    ▦ add    │
│   Wildfires (EONET)          38  ●fresh         ◇ on    ▦ ─      │
│   FIRMS fires           key-gated ○             ◇ ─     ▦ ─      │
│ AVIATION (roll-up)                              ◇ Map   ▦ Widget │
│   Planes (ADS-B)           9.1k  ●fresh         ◇ on    ▦ ─      │
│ …                                       [ all ] [ none ] [ invert ] │
└──────────────────────────────────────────────────────────────────┘
```

- `◇ Map` = render this source on the Map tile (today's `layersStore`/`signalsStore` on/off).
- `▦ Widget` = give this source a standing grid tile.
- **Invariant (review-enforced):** exactly **one** piece of state per `(source, axis)`,
  `axis ∈ {map, widget}`. The Catalog row, the widget footer's `◇ on map` toggle, and the
  ⌘K action all read/write the *same* store value. Any place a map toggle exists that does
  not mirror in the Catalog is a forked-state bug.
- The Catalog **is** the "add widget" tray (same surface, opened from the ⊞ Add control or
  ⌘K) — no separate disconnected tray.

---

## 4. Widget taxonomy & the generic monitor widget

### 4.1 Three tiers (built on the existing `group` field — no new taxonomy)

- **Tier 0 — Utility widgets (~10):** Map, Video, Daily Brief, News, Markets, Watchlist,
  Coverage, Freshness, Clock, Search/Catalog. The spine of every layout.
- **Tier 1 — Category roll-up monitors (~12, one per `group`):** Hazards, Aviation,
  Maritime, Space & Sky, Infrastructure, Geopolitics, Cyber, Human Cost, Environment,
  Energy/Grid, Cameras, Civic. **The default unit** — so "widgetize everything" is ~22
  widget *types* normally touched, not 53 tiles of noise.
- **Tier 2 — Single-source leaf widgets (39+):** one `CatalogSource` each. **Born from a
  pop-out drill-down** inside a roll-up (expand → "pop out" a row → a leaf tile appears,
  pre-placed). Reachable from Catalog search, **never** in a default preset.

### 4.2 Standard monitor-widget anatomy (`components/shell/SourceWidget.tsx`)

Every Tier-1/Tier-2 data widget renders from one shell:

```
┌─ HEADER (28px) ────────────────────────────────────────┐
│ ◐ HAZARDS              142 ▴   ⬣3   ●live 2m   ⋯   ⤢    │
│   glyph+color  title   count delta sev  freshness  menu expand
├─ BODY (events | scalar | series | area) ───────────────┤
│  ▸ M5.8  Hindu Kush      12m  ███▆▂   ← 3px sev edge    │
│  ▸ M4.2  off Honshu      31m  ██▃                       │
│  (roll-up = top-N by severity×recency across its sources)│
├─ FOOTER (20px) ────────────────────────────────────────┤
│  USGS · EONET · GDACS                    ⓘ   ◇ on map ✓ │
└─────────────────────────────────────────────────────────┘
```

- **Header (in order):** category glyph+dot · title (`group` for roll-ups, `label` for
  leaves) · live count · ▴/▾ delta vs last refresh · severity micro-count · freshness dot+age
  · ⋯ overflow (pin / sync-to-map / refresh / remove) · ⤢ expand.
- **Body** picked from `bodyKind`: `events` = virtualized list (default); `scalar` =
  hero stat/gauge (instability, grid-load, space-weather Kp, air-quality); `series` =
  sparkline; `area` = mini coverage readout. Below ~h3 the body **auto-collapses to glance
  mode** (hero count + one sparkline) so small tiles never look broken.
- **Footer:** mandatory `attribution` (baked into the shell so no source ships without
  credit) + the mirrored `◇ on map` toggle.
- **Activity affordances (worldmonitor):** `NEW` tag for ~2 min, 30s glow on change, a
  count badge on collapsed tiles, "seen" via IntersectionObserver. Collapsed tiles **keep
  updating** (subscription stays live; only off-screen/un-wanted sources stop polling).

---

## 5. The Workspace grid (`components/shell/Workspace.tsx`)

- **Engine:** `react-grid-layout@2.2.3` (spike GO, `2026-06-27-sp1b-rgl-spike.md`). 2.x
  hooks API: `ResponsiveGridLayout` + `useContainerWidth` (gate render on `mounted` for
  SSR-safety). **Do not** install `@types/react-grid-layout` (types the wrong 1.x API).
  Import `react-grid-layout/css/styles.css` + `react-resizable/css/styles.css`.
- **Grid:** 12 cols `lg`; rowHeight ≈ 30–64px. Breakpoints `lg`/`md`/`sm`/`xs`/`xxs`.
- **Draft-then-commit (spike finding):** hold the working layout in component state, update
  it in `onLayoutChange` (required or a controlled grid reverts after drop), and **commit on
  drag/resize stop** into `variantStore.setLayout(activeId, placements)` → writes the
  reserved `variantStore.layoutOverrides[activeId]` (declared + persisted today, never
  written). `diff.ts` is **unchanged** — layout is a separate channel from the
  `OverrideDelta` (layers/signals/theme).
- **Geometry source of truth:** `PANEL_REGISTRY[key].defaultGrid` (already carries real
  per-widget `{x,y,w,h}` + `minW/minH`). The variant `panels[]` array meaningfully carries
  only `{key, visible}`; `builtins.ts`'s `slot()` grid values are placeholders and are
  ignored for geometry.
- **Variant switch** re-seeds the grid: `Workspace` re-derives local layout in a `useEffect`
  keyed on `activeId` (`defaultGrid ⊕ variant placement ⊕ layoutOverrides[activeId]`).
- **Reset:** `variantStore.resetLayout(activeId)` clears the override; a "Reset to preset
  (12 changes)" control is first-class.

### 5.1 Map as a tile (`components/WorldMap.tsx`)

- `.world-map`/`.map-canvas` CSS → fill the tile (`100%`) instead of `100vw/100vh`.
- **The one must-do:** add a `ResizeObserver` on the tile container → rAF-throttled
  `map.resize()` (rgl resizes via CSS transforms and does **not** fire a window resize, so
  the WebGL buffer goes stale without this). Also hook `onResizeStop`.
- `addAppLayers` (idempotent on `style.load`), clustering, and `wireInteractions` are
  **unaffected** by tiling.
- **Map is pinned & non-removable** (avoids the expensive `map.remove()`→re-`new Map`
  churn). Enforce `minW/minH`. A "focus map" key (⌘.) temporarily maximizes it without
  destroying the layout.

---

## 6. Performance spine (`components/shell/FeedHost.tsx`)

The existing "hidden layer doesn't fetch" pattern is the right design and must be preserved:

- **Widgets are read-only store subscribers — they never `fetch()`.** Hard rule.
- **All polling lives in gating `<Feed>` components, hoisted out of `WorldMap` into one
  `<FeedHost>`** mounted in `ConsoleShell`, so data flows even when the map tile is
  collapsed/removed and so widgets work without the map.
- **Source-demand ref-counting:** the fetch predicate moves from "map layer visible" to
  **"map layer on `OR` a widget for this source is placed."** (D2 implies a source can be
  widgeted without being on the map and vice-versa.) One `<Feed>` per *wanted* source,
  regardless of how many widgets read it → N subscribers, 1 fetch.
- **Visibility gating extends to widgets:** an off-screen/collapsed widget whose source is
  not otherwise wanted does not keep its source polling; pause **all** polling on tab blur
  (`document.visibilitychange`). Backoff + auto-widen `refreshMs` on 429 (surfaced as the
  rate-limited state).
- Preserve existing re-render hygiene (`metricsStore`/`signalCountsStore` shallow-equal
  guards; satellites re-stamp metrics only on count change).
- **`signalDataStore` (NEW, id → recent `WorldObject[]`):** today per-source feature arrays
  live in `WorldMap` component state. Count/freshness widgets need none of this; **list**
  widgets do. The gating `SignalFeed` already holds the objects — it writes them to
  `signalDataStore` alongside counts. Added in the list-widget phase, not Phase 1.

---

## 7. The Video widget (`components/PersistentPlayer.tsx` + `lib/video/playerStore.ts`)

One persistent **widget** owning the player; tabbed **News** / **Cameras**.

- **Cameras tab:** persistent `hls.js` playing `/api/hls?id=…` (the closed proxy). Replaces
  `CameraVideo.tsx`'s per-open create/destroy; `loadSource()` on channel swap, never
  re-`new Hls`. `CameraImage` stays the jpeg fallback. `CameraDetail`/dossier delegate
  playback to the store instead of mounting their own video.
- **News tab (D4 — HLS-first, YouTube fallback):**
  - A `lib/video/newsChannels.ts` registry: `{ id, label, kind: 'hls' | 'youtube', src }`.
  - `kind:'hls'` channels (DW, France 24, Al Jazeera, Euronews, NASA, …) play through the
    **same `hls.js` engine** via `/api/hls` — **no new origin, no CSP change, no tracking**.
    Curated from official broadcaster streams + the **iptv-org** "news" catalog, with the
    same freshness/verify-before-wiring + fallback discipline used for cameras (streams
    rotate). Add the HLS hosts to `lib/proxy/hls-allowlist.ts`.
  - `kind:'youtube'` channels (only those with **no** public HLS — Sky/Bloomberg/BBC) load a
    **scoped, lazy** YouTube IFrame: loaded only when that channel is selected, sandboxed,
    `enablejsapi=1`, `origin=<location.origin>`, muted+`playsinline`. CSP `frame-src`/
    `script-src` allows `*.youtube.com`/`*.ytimg.com` **only**. This is the single scoped
    exception to the all-proxied invariant, gated to fallback channels.
- **`playerStore` (`useSyncExternalStore`, `{ mode:'news'|'camera', activeId }`):** module
  singleton → engine *state* survives any remount.
- **Survive grid re-layout (key constraint):** render `<PersistentPlayer>` **once at app
  root** and **`createPortal`** its `<video>`/iframe into the active Video tile's slot ref.
  rgl moves tiles by CSS transform on the same node, but add/remove remounts — the portal
  protects the element from reload.
- **Idle/visibility:** `video.pause()` (or YT `pauseVideo()`) on tab-hide and after 5 min
  idle; resume on next activate. Muted-autoplay on first activate (browser policy).
- **SSRF:** camera + HLS-news both proxied; no raw stream URL reaches the client. YouTube
  fallback is client-embedded (no SSRF), scoped by CSP.

---

## 8. Density, severity & freshness systems

- **Severity ramp (shared map+widget):** S0 info `#64748b` · S1 notice `#d97706` · S2
  elevated `#ea580c` · S3 severe `#dc2626` · S4 critical `#9f1239`. Derived from
  `props.magnitude` where present, else a per-source `severityOf(feature)` (defaults S0).
  The same red on the globe = the same red in the widget row.
- **Freshness is a separate, non-competing channel:** green (fresh) / amber (stale) / grey
  (offline/never) / **hollow ring (key-gated, unset)**. Always **color + shape** (filled/
  half/hollow) for color-blind safety. Never reuse severity reds for freshness.
- **Density rules:** one hero number per widget; 22–26px single-line rows with a 3px left
  severity edge; signed colored deltas (▴/▾, %); relative quantized timestamps ("2m","1h");
  tabular-nums on every live count; **no idle animation** (update = one 400ms highlight, then
  settle). Color reserved for severity + freshness only.
- **Typographic scale:** `hero` 20/600 · `label` 13/600 · `body` 12/400 · `micro` 11/500
  caps.

---

## 9. States & edge cases

Per-widget state machine, driven by the freshness spine (`lib/freshness.ts`,
`lib/signals/freshness.ts`). Empty and error **must look different** (with 39 live pollers,
trust hinges on telling "nothing happening" from "I'm broken"):

| State | Trigger | Render |
|---|---|---|
| Loading (first) | no data yet | skeleton + grey "loading"; **never** show "0" |
| Live | recent success, count>0 | normal; green dot + age |
| Empty (healthy) | recent success, count=0 | explicit "No active events" + green dot |
| Stale | last success > ~3×`refreshMs` | amber dot+age, last-known dimmed 60%, "as of 14m" |
| Offline/error | repeated failures | grey dot, "Can't reach source", retry, keep last-known dimmed |
| Rate-limited | 429/backoff | amber + "rate-limited, backing off"; auto-widen `refreshMs` |
| Key-gated, unset | `keyEnv` not present (FIRMS/ACLED/OpenAQ/ReliefWeb/AISSTREAM/ENTSO-E) | **hollow ring**, "Needs API key", muted, **excluded from "all fresh" tallies** |

- **Roll-up freshness = worst-of** its sources (expand reveals per-source). Never average —
  averaging hides a dead source.
- **Honesty is the product's credibility** (e.g. the OpenSky→adsb.lol swap must show OpenSky
  as "off", never fake-green).

---

## 10. Responsive / mobile

rgl per-breakpoint layouts, persisted **per breakpoint** so a phone edit doesn't wreck the
desktop layout. `lg` (≥1200, the design grid) · `md` (768–1199, 6-col) · `xs` (<768):
**single column, stacked, map pinned first** as a fixed ~50vh tile; drag/resize **disabled**
on touch (reorder via long-press handle only); Video becomes a dismissible sticky
mini-player. Mobile = a curated subset, **not** a shrunk 12-col grid.

---

## 11. Accessibility & pitfalls

- **Keyboard-reorderable tiles** (arrow-key move/resize on a focused tile) + an "arrange"
  list view as a non-drag fallback.
- Every severity/freshness indicator pairs **color + shape/label** (never color-only).
- Respect `prefers-reduced-motion` (kill update-flash + globe auto-rotate). Min hit target
  24px. `aria-live="polite"` announces **only S3+** changes, never every count tick.
- **Guardrails:** Map min-size enforced + non-removable + "restore Map" if somehow gone;
  always-available "Reset to preset"; cap auto-persist to the active layout; one central
  poll scheduler (no per-widget timers); "calm mode" caps simultaneous animated elements
  (Video is the only continuous motion, user-initiated).

---

## 12. Phased delivery

Each phase is independently shippable, build-green, solo-attributed. **Phase 1 is the
immediate target.**

- **Phase 1 — Source Catalog + monitor widgets (+minimal grid host).** `SOURCE_CATALOG`
  (core ⊕ signals); generic read-only `SourceWidget` (count + delta + severity + freshness +
  attribution, `bodyKind` scalar/events); Tier-1 roll-ups + Tier-2 leaf pop-out; the
  two-toggle Catalog (evolve `LayerRail`); a **minimal static `Workspace`** to host tiles
  (drag deferred). No new pollers (reads existing stores). *This is the visible
  "widgetize everything" payoff.*
  **Coexistence note:** in Phase 1 the **map stays full-bleed** and the static Workspace
  renders the new widgets in the existing panel region (the docked chrome area today's
  `PanelHost` occupies) layered over the globe. The map only *moves into* the grid as a tile
  in Phase 3; until then it is the background, not a `WidgetHost(map)`. The §2 architecture
  diagram is the end-state (post-Phase 3), not the Phase-1 layout.
- **Phase 2 — Live Workspace grid.** rgl drag/resize/add/remove; commit-on-drop into
  `layoutOverrides`; reset-to-preset; deep-linkable layout.
- **Phase 3 — Map as a tile.** ResizeObserver→`map.resize()`; pinned/min-size; CSS fill.
- **Phase 4 — FeedHost + ref-counting.** Hoist gating feeds; "map OR widget wants it"
  predicate; visibility/backoff gating; widgets-never-fetch enforced.
- **Phase 5 — Video widget (HLS).** `playerStore` + `PersistentPlayer` (portal-to-slot);
  Cameras tab; News tab HLS channels; dossier delegates playback.
- **Phase 6 — News YouTube fallback.** Scoped, lazy, sandboxed YT engine for no-HLS
  channels; CSP policy.
- **Phase 7 — List/detail widgets.** `signalDataStore`; events-list bodies; feed↔map fly-to
  + selection sync via `lib/overlay.ts`.
- **Phase 8 — Presets + palette + share.** Populate real `panels[]` grids per built-in
  variant (Overview/Aviation/Hazards/Maritime); extend ⌘K to index sources/widgets/presets;
  share-URL carries the layout; retire the legacy slide-in open-stores.

Phases 2–4 can reorder; Phase 1 deliberately ships widgets first (D6) inside a static host,
then the grid wraps them.

---

## 13. Future modules (register into this seam, not built here)

Live-video wall (N×M mixed news/camera/follow-cam); "probe at point" multi-source readout
(Windy-style); cross-source correlation tiles (quake → nearest cameras + diverted flights +
ports); GPX route + cameras (M7); aurora/space-weather "look up tonight"; per-source health
widget; snapshot/baseline deviation ("above 7-day normal", IndexedDB).

---

## 14. Files (Phase 1 unless noted)

**ADD:** `lib/sources/catalog.ts` · `components/shell/SourceWidget.tsx` ·
`components/shell/SourceCatalog.tsx` (evolve `LayerRail`) · `components/shell/Workspace.tsx`
(minimal/static in P1) · `components/shell/WidgetHost.tsx` · `lib/widgets/registry.ts`
(roll-up + leaf widget descriptors). Later: `components/shell/FeedHost.tsx` (P4) ·
`lib/video/playerStore.ts` + `components/PersistentPlayer.tsx` + `lib/video/newsChannels.ts`
(P5/6) · `lib/signals/signalDataStore.ts` (P7).

**CHANGE:** `lib/variants/store.ts` (+`setLayout`/`resetLayout`/`useLayout`; P2) ·
`components/shell/ConsoleShell.tsx` (render `<Workspace>`; mount `FeedHost`+`PersistentPlayer`;
P1+) · `lib/shell/panelRegistry.ts` (extend into the tile/widget registry; add map+video +
generated per-source entries; real `minW/minH`) · `components/WorldMap.tsx` (ResizeObserver
+ tile CSS + hoist feeds; P3/4) · `app/globals.css` (tile chrome + rgl CSS; P1+) ·
`lib/signals/types.ts` (optional `bodyKind`/`severityOf`) · `lib/proxy/hls-allowlist.ts`
(news HLS hosts; P5).

**UNCHANGED:** `lib/variants/diff.ts`, `resolveSignals`, `captureOverride` (layout is a
separate channel); the signals registry contract; clustering; dossier.

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Map resize blur/clip in a grid | ResizeObserver→`map.resize()` (rAF-throttled) + `onResizeStop`; verified before P3 ships |
| 50 widgets → 50 pollers | Widgets never fetch; FeedHost + source-demand ref-count; one scheduler |
| News HLS streams rotate/die | iptv-org catalog + per-channel freshness + verify-before-wiring; YouTube fallback for stubborn channels |
| YouTube origin/CSP leak | Scoped to no-HLS channels only; lazy + sandboxed; tight `frame-src` |
| Layout chaos / un-resettable | Edits are an override delta; first-class "Reset to preset"; map pinned + min-size |
| Attention overload | Roll-ups are the default unit; calm mode; severity color per-row not per-tile |
| rgl 2.x API drift from 1.x docs | Spike already validated 2.x hooks API; no `@types/react-grid-layout` |
