# SP1 · Variant / Config Spine — Design Spec

> Date: 2026-06-27 · Status: Draft (revised after Opus 4.8 design review) · Owner: Sampo
> Part of the TrafficNerd V2 **UI overhaul** (SP1 of a phased decomposition — see §0).
> Supersedes and expands `docs/superpowers/prds/monitor-variants.md`.
> Revision note: this version incorporates a maximum-rigor design review that verified
> every claim against the code. Material changes: taxonomy rebound to the **real**
> registry ids/groups (§3); a **single hydration authority** resolves the load-time
> race (§5); `brief`/`dossier` reclassified (§6); SP1 **split into SP1a + SP1b** (§0.2)
> to isolate the react-grid-layout risk; RGL risk re-scoped — a React-19-compatible
> release exists (§7).

## 0. Where this sits

### 0.1 Decomposition
The overhaul = one foundation + feature modules that plug into it. This spec covers
**only the foundation**. It does **not** build new feature panels (palette upgrade,
risk-scoring dossier, AI-brief export, route/scenario workflows, cinematic zoom) —
those are later sub-projects (SP2–SP7) that register into the seam created here.

### 0.2 SP1 splits into two independently-shippable slices
The review flagged that "one foundation" bundled a zero-risk part with the entire
react-grid-layout (RGL) risk. We split:

- **SP1a — Variant model & calm-by-default shell (no RGL).** The `Variant` data model,
  all 13 built-in variants, `applyVariant`, the single hydration authority,
  persistence + URL sharing, the variant-selector pill, and a **config-driven shell
  that renders each variant's panels in fixed preset positions** (no dragging yet).
  This ships the entire "calm default + 13 monitors from one engine + shareable views"
  value with **zero RGL dependency**.
- **SP1b — Dockable workspace (RGL).** Adds react-grid-layout for on-canvas
  drag/resize and the 5-tab draft-then-commit settings editor. Gated behind the RGL
  spike (§7). If the spike fails, SP1b swaps to the `@dnd-kit` fallback without
  touching SP1a.

Each slice gets its own implementation plan. SP1a is the immediate target.

### 0.3 Decisions locked during brainstorming

| # | Decision | Choice |
|---|---|---|
| 1 | Identity vs WorldMonitor's "overwhelming" #1 complaint | **Two modes** — calm default + dense opt-in |
| 2 | How the modes relate architecturally | **Preset-driven variants** |
| 3 | Panel control granularity | **Full dockable workspace** (SP1b) |
| 4 | Layout engine | **react-grid-layout** (cards over a full-bleed map) |
| 5 | Guiding principle reconciling 1 vs 3 | **Calm by default, powerful on demand** |
| 6 | Themed-variant scope | **One variant per information category** (all 14 covered) |

**Calm-by-default is load-bearing.** `research/differentiation.md` names the
drag-to-reorder grid as part of WorldMonitor's #1 "extremely overwhelming" complaint.
Resolution: the default `explore` variant ships minimal (map + the left rail only,
nothing else), so a first-time visitor never meets the grid. Docking power is opt-in
(the `intel` preset, or the moment a user customizes). SP1a delivering value *without*
the grid is itself proof the calm default isn't a fig leaf.

## 1. Architecture & central idea

Today the shell is **hardcoded**: `components/shell/ConsoleShell.tsx` renders a fixed
list of 11 panels; `lib/layers.ts` is a flat boolean record; `lib/signals/store.ts`
is an id→bool map; theme lives in `lib/shell/ui.ts`. A single **`Variant`** config
object becomes the source of truth for what the shell shows.

### Refactor stance: *seed, don't rewrite* — with one hydration authority

Keep the existing runtime stores (`layersStore`, `signalsStore`, `uiStore`,
`cameraFilterStore`) as the **live** sources of truth *during a session*. A new
`variantStore` is the **sole load-time authority** (resolving §5) and owns the
genuinely-new state: active variant id, per-variant override deltas, per-variant panel
layout, and saved user variants. `applyVariant(v)` seeds the runtime stores through
their setters; it does **not** introduce a parallel copy of layer/signal state that
can drift (the review's C2 race — see §5).

The mega-store alternative (one store owns everything, delete the others) is a
big-bang rewrite of working, tested code and is **rejected** as unnecessary risk.

## 2. Data model

```ts
// lib/variants/types.ts (new)

type PanelKey =
  | 'layerRail' | 'markets' | 'brief'
  | 'freshness' | 'news' | 'watchlist' | 'coverage';
// NOTE: 'dossier' is intentionally NOT a PanelKey — it is the FeedOverlay slide-in
// (transient, context-triggered, focus-managed, deep-linked via ?obj=). It stays
// overlay chrome, never a workspace card. (Review M1.)

interface PanelPlacement {
  panel: PanelKey;
  grid: { x: number; y: number; w: number; h: number; minW?: number; minH?: number }; // SP1b
  visible: boolean;   // the single owner of panel visibility (Review M2)
}

/** Signal selection: groups (auto-expand as the catalog grows) and/or explicit ids. */
interface SignalSelection {
  groups?: string[];   // verified registry `group` strings
  ids?: string[];      // verified registry ids
  exclude?: string[];  // ids dropped after group expansion
}

interface Variant {
  id: string;                     // 'explore' | 'intel' | … | <nanoid> (user variants)
  builtin: boolean;
  title: string;
  tone?: string;
  accent: string;                 // hex → --accent
  theme: 'light' | 'dark';
  layers: Partial<LayerState>;    // core world layers
  signals?: SignalSelection;
  panels: PanelPlacement[];
  view?: { lon: number; lat: number; zoom: number };
  cameraFilter?: Partial<CameraFilterState>;
}
```

`resolveSignals(v)` expands `v.signals` against `lib/signals/registry.ts`
(`signalsByGroup()` + `getSignal`) into a concrete `SignalState`. **Honesty note
(Review C1):** the registry groups by *data-source category* (Natural hazards,
Infrastructure, Human cost…), while several variants are *lenses* that cut across
those groups — so those variants bind explicit `ids` and will **not** auto-include
future signals; only pure-group variants do. The §3 table marks which is which. A
future `lens?: string[]` tag on `SignalSource` would let every variant auto-grow;
deferred (touches ~30 source files), out of SP1 scope.

`diffFromVariant(live, preset)` (new, pure, unit-tested) computes the override delta.
Signals compare canonically (**absent ≡ false** — `signalsStore` holds all ~30 ids,
`resolveSignals` yields only the on-set). It powers both the "· edited" marker and the
diff-only URL encoding (§5).

## 3. Built-in variant taxonomy (bound to the REAL registry)

Verified id→group map (from `lib/signals/*.ts`, 2026-06-27):

- **Synthesis**: `instability`
- **Natural hazards**: `earthquakes`, `emsc-quakes`, `fire-active`, `gdacs`, `tropical-cyclones`, + EONET `wildfires`/`volcanoes`/`severe-storms`/`floods`
- **Weather**: `weather` · **Environment**: `airquality`, `air-quality-stations`
- **Space**: `launches` · **Space weather**: `aurora`, `swpc:status`
- **Infrastructure**: `airports`, `ports`, `cables`, `nuclear`, `gpsJamming`, `internet-outages`, `grid-load`
- **Maritime**: `ais` · **Military**: `military-air`
- **Intel**: GDELT `conflict`/`protests` · **Conflict**: `acled`
- **Cyber threat**: `cyber-c2`, `cyber-ransomware` · **Civic safety**: `crime`
- **Human cost**: `displacement`, `food-security`, `reliefweb`

13 built-in variants (`lib/variants/builtins.ts`), each pure static data:

| Variant | Lens | Core layers | Signal selection (✓group = auto-grows) | Default panels (SP1a fixed slots) |
|---|---|---|---|---|
| **explore** *(default)* | Calm transport | cameras, planes | — | layerRail |
| **intel** | Full awareness | all | ✓ all groups | layerRail, freshness, brief, markets, news |
| **cameras** | City CCTV | cameras, webcams | — (cameraFilter liveOnly) | layerRail |
| **aviation** | Air traffic | planes | ids: `military-air`,`airports`,`launches` | layerRail, freshness |
| **maritime** | Shipping | — *(`ships` planned)* | ✓Maritime + ids `ports`,`cables` | layerRail, freshness |
| **orbital** | Space | satellites | ✓ Space, Space weather | layerRail |
| **hazards** | Nature | — | ✓ Natural hazards, Weather | layerRail, freshness, news |
| **geopolitics** | Conflict | — | ✓ Conflict, Intel, Military + ids `displacement`,`instability` | layerRail, brief, news, freshness |
| **humanitarian** | Human cost | — | ✓ Human cost + ids `airquality`,`instability` | layerRail, brief, freshness |
| **infrastructure** | Energy/connectivity | — | ✓ Infrastructure | layerRail, freshness |
| **cyber** | Cyber threat | — | ✓ Cyber threat + id `internet-outages` | layerRail, news, freshness |
| **civic** | Local safety | — | ✓ Civic safety, Environment | layerRail, freshness |
| **markets** | Economic | — | ids: `instability` | layerRail, markets, brief |

Every one of the 14 groups is covered (Review M4 fixed — `civic` added for Civic
safety). Key-gated signals (acled, fire-active, ais, air-quality-stations, reliefweb,
grid-load) appear in their variant but render empty without the env key — consistent
with the rest of the app; an empty layer shows the existing "0" count, never an error.
`ships`/`weather` core layers are `PLANNED_LAYERS` (no source) — `maritime`'s real
data is the `ais` signal; the table reflects that.

## 4. The workspace & editing model

**SP1a (fixed slots):** the shell renders each visible panel in its preset grid slot —
no dragging. This is enough to make all 13 variants feel bespoke.

**SP1b (dockable):** the map stays a full-bleed background (`z-index: 0`); a
**transparent** RGL overlay sits on top — only cards paint; the grid container + empty
cells are `pointer-events: none` so the map stays pannable; each card sets
`pointer-events: auto`. Panels render inside a standard **`<PanelFrame>`** (title/drag
handle, **inline source + timestamp affix**, collapse, close).

**Two editing surfaces, reconciled (Review M3):**
- **On-canvas drag/resize** (SP1b) is **live** and persists immediately to the active
  variant's `layoutOverrides`.
- **The settings modal** (tabbed: *Layers · Signals · Panels · Theme · View*) is
  **modal/blocking** — it disables canvas drag while open. Its draft is **seeded from
  the current live layout** on open, so prior drags are preserved; **Save** writes the
  draft (which already contains those drags); **Cancel** discards; **Save as new**
  mints a user variant. Draft-then-commit prevents the panel-thrash of live-applying
  every checkbox. There is exactly one write path per save.

**Mobile:** drag-resize is desktop-only; below a breakpoint the grid collapses to the
existing responsive stacked / bottom-sheet layout. The modal still toggles visibility.

## 5. Persistence, the single hydration authority & sharing (keyless)

Reuses `lib/shell/persist.ts` (versioned, SSR-safe) and extends `lib/share/url.ts`.

**Stores & keys.** `variantStore` persists `tn.variant.v1`:
`{ activeId, userVariants: Variant[], overrides: Record<id, OverrideDelta>,
layoutOverrides: Record<id, PanelPlacement[]> }`. The existing `tn.layers.v1` /
`tn.signals.v1` / `tn.ui.v1` keys are demoted to **write-through caches** — still
written on live edits, but **no longer read on load** (Review C2).

**Single load-time resolution (the only hydration path).** `ConsoleShell` calls
`variantStore.bootstrap()` instead of the per-store `hydrate()`s:
1. Parse URL (`lib/share/url.ts`).
2. `activeId = url.v ?? persisted.activeId ?? 'explore'`; unknown id → `'explore'`
   (silent fallback, mirroring the existing "unknown param dropped" rule).
3. `resolved = resolveVariant(activeId)` = preset defaults ⊕ `overrides[activeId]`.
4. Apply field-level URL overrides on top (**`v` first, then `layers`/`base`/etc.**;
   `obj` opens the dossier overlay, untouched — Review M5).
5. Seed the runtime stores from `resolved` (in-memory; their own keys are not read).
6. (SP1b) load `layoutOverrides[activeId] ?? preset.panels`.

**Capturing divergence.** On any runtime change, `diffFromVariant(live, preset)` writes
`overrides[activeId]`. Non-empty ⇒ the header shows a subtle "· edited" marker.
**"Reset to <variant>"** clears `overrides[activeId]` and re-seeds from the preset.

**URL sharing.** Extend `ViewState` with `v` (variant id) and a **diff-from-preset-only**
encoding of layer/signal/panel divergence, with a hard length cap (the codec already
caps `obj` at 96 chars "to keep shared links sane"). Full-state links would overflow;
encoding only the delta keeps them shareable. The codec stays pure/isomorphic and
unit-tested.

## 6. Shell refactor + the extensibility seam

`ConsoleShell` stops hardcoding panels. New **`PANEL_REGISTRY`**
(`lib/shell/panelRegistry.ts`):

```ts
const PANEL_REGISTRY: Record<PanelKey, {
  component: React.ComponentType;
  title: string;
  category: 'core' | 'intelligence' | 'markets';  // for the editor's grouping
  defaultGrid: PanelPlacement['grid'];
}> = { /* layerRail, markets, brief, freshness, news, watchlist, coverage */ };
```

The shell renders: always-on chrome (`StatusBar`, ⌘K `CommandPalette`, the
**variant-selector pill**) + a `<PanelHost>` that maps the active variant's *visible*
placements through the registry (fixed slots in SP1a; RGL grid in SP1b). **This
registry is the seam SP2–SP7 plug into.**

**Required wiring fixes (Review M1/M2):**
- **Extract `DailyBrief` from `MarketsPanel`** — it is currently rendered *inside*
  `components/shell/MarketsPanel.tsx:111`, but `brief` and `markets` are separate
  `PanelKey`s and variants (geopolitics, humanitarian) want `brief` without `markets`.
  This is a small refactor, an explicit SP1a task — not a "wrap".
- **`dossier`/`FeedOverlay`, `BreakingBanner`, `PlaceSearch`, the map** stay outside
  the registry (overlay/full-bleed chrome, not cards).
- **One owner per state (M2):** panel visibility is owned solely by
  `PanelPlacement.visible`. The existing `uiStore.railOpen` and `uiStore.newsTicker`
  toggles are **retired** (their visibility now flows from the active variant);
  `uiStore` keeps only `theme`, which the variant seeds (write-through).

## 7. Risks & edge cases

- **react-grid-layout × React 19 / Next 15 (SP1b only).** Verified stack:
  `react@19.0.0`, `next@15.5.19`, RGL not yet installed. The fear in the prior draft
  was based on the abandoned RGL **1.x** (`findDOMNode`). RGL shipped **2.x in
  Dec 2025** (`react-grid-layout@2.2.3`, peer `react ≥16.3`, via
  `react-draggable@4.7.0` which uses `nodeRef`). **Action:** pin
  `react-grid-layout@2.2.3` (exact, not `^2`); the spike is no longer existential — it
  verifies **(i)** drag *and* resize don't throw under React 19, and **(ii)**
  SSR/hydration: RGL's `WidthProvider` measures width *post-mount*, so the grid is
  client-only and may delay/ reflow panel paint. The "instant, no spinner" contract
  (`zero-friction-instant-load`) holds for the map + chrome; the **grid panels may
  reflow on mount** — the spike must confirm the magnitude. `@dnd-kit` remains the
  documented fallback. SP1a has none of this risk.
- **a11y / keyboard (SP1b).** RGL drag/resize is pointer-only; keyboard users
  reposition via the modal's Panels tab (the a11y path), not the canvas. `PanelFrame`
  drag handles get proper `role`/`aria`; the grid must not trap focus. State this.
- **SSRF/proxy unchanged.** Variants only re-weight existing layers; all media still
  routes through the closed `/api/proxy` + `/api/hls` allowlists. No new origins.

## 8. Testing

- **Unit (vitest, node):** variant resolution + precedence (defaults → overrides →
  URL); `resolveSignals` group→id expansion incl. `exclude`; `diffFromVariant` with the
  signal absent≡false asymmetry; `url.ts` round-trip with `v` + diff-only params and
  the length cap; `panelRegistry` lookups; unknown-id → `explore` fallback.
- **Component:** variant switch applies layers + signals + theme + accent + panel
  visibility; "Reset to variant"; editor draft-commit (no live apply until Save; Cancel
  discards; Save-as-new). **RGL caveat:** direct drag/resize is not unit-testable in
  jsdom (no real layout/ResizeObserver) — covered by visibility/registry/serialization
  tests + manual/e2e for the drag itself; §8 does not pretend otherwise.
- **Gate:** keep the current passing baseline green — **run `npx vitest run` to read
  the real number; do not hard-code a stale count.** `npm run build` (ESLint) is
  authoritative; never run `next dev` concurrently with the build.

## 9. Scope boundary

- No new feature panels — wires **existing** panels into the registry (palette upgrade,
  risk dossier, brief export, route/scenario, cinematic zoom = SP2–SP7).
- No accounts/server — saved variants are localStorage + shareable URL only.
- No panel-internal redesign beyond `<PanelFrame>` (+ the `DailyBrief` extraction).
- No subdomain routing for variants (old PRD's `middleware.ts` idea deferred; in-app
  selector + `?v=` suffices).
- A future `lens`/`tags` field on `SignalSource` (to make id-bound variants auto-grow)
  is out of scope.

## 10. Decisions resolved (Sampo's review, 2026-06-27)

1. **Split — CONFIRMED.** Ship **SP1a** (no-RGL variant shell, all 13 variants, URL
   sharing, fixed-slot panels) as the first implementation plan; **SP1b** (dockable
   RGL grid + draft-commit editor) follows after the spike.
2. **`explore` default — map + left layer rail** (rail visible on first paint; aids
   discovery while staying calm — one panel, no grid).
3. **`civic` variant — kept dedicated** (one variant per registry category; pure
   config, honest about thin coverage).
4. **`intel` density — 5 default panels** (layerRail, freshness, brief, markets, news)
   stands unless playtesting shows the calm/dense contrast is too soft.
