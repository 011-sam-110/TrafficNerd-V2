# TrafficNerd — Segmented Widget Console (redesign)

**Date:** 2026-06-28
**Status:** Design — approved in brainstorm, pending spec review
**Builds on:** branch `feat/ground-truth-console-redesign` (the console-first work). Supersedes the
console/explore split with a single segmented widget shell.
**Visual mockups:** `.superpowers/brainstorm/2120-1782679303/content/*.html` (layout-v2, category-card,
full-shell, palette-catalog, video-news).

---

## 1. Vision

TrafficNerd becomes a **composable live-monitoring console**. The screen is a fixed map/stage in the
centre, flanked by three resizable, collapsible, scrollable **segments**. Each segment holds **widgets** —
rich, self-contained category cards (Aviation, Live Video News, Cameras, Disasters…). Every widget is a
**monitoring surface**: it shows plenty of detail *and* auto-surfaces "something important to my job just
happened." A user picks a **preset** for their field and the segments fill with the widgets relevant to
them; they add more from the **command palette**, drag widgets between segments, run several at once, and
save their own arrangement.

The north star: a professional (an aviation ops controller, a journalist, a disaster-response coordinator)
opens their preset and, at a glance, sees their world — and is pulled to whatever just changed.

---

## 2. Vocabulary

| Term | Meaning |
|------|---------|
| **Shell** | The whole app frame: top bar + centre stage + three segments + overlays. |
| **Segment** | One of three resizable / collapsible / **scrollable** regions: **Left**, **Right**, **Bottom**. Each is a vertical scrolling stack of widgets. |
| **Centre stage** | The fixed middle region. Holds exactly one **stage widget**, swappable: **3D map / 2D map / World clock**. Position-locked; grows as segments collapse. |
| **Widget** | A category card (a `WidgetType` instance). Rich, detailed, monitorable. |
| **Widget instance** | A specific live card with its own config. Widgets are **multi-instance** (e.g. two Live News cards on different channels). Hard cap **50** instances total. |
| **Preset** | A named bundle that *replaces* the current arrangement: which widgets exist, in which segments, segment sizes, stage choice, map layers/scope/theme. Built-in or user-saved. (Extends today's `Variant`.) |
| **Alert** | A notable-change item a widget detects via its curated rules, shown in the card's "Needs attention" strip + badge. |

---

## 3. The shell layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ TrafficNerd   [✈ Aviation Ops ▾]      [3D|2D|🕐]   Satellite ◎World ⌘K Share EN ☾ │  top bar
├──────────┬──────────────────────────────────────────────┬───────────┤
│  LEFT    │                                              │  RIGHT     │
│ segment  │              CENTRE STAGE                    │  segment   │
│ (scroll) │          (3D / 2D map · or clock)            │ (scroll)   │
│ [widget] │                                              │ [widget]   │
│ [widget] ├──────────────────────────────────────────────┤ [widget]   │
│   ⇕      │              BOTTOM segment (scroll)          │   ⇕        │
│          │              [widget] [widget]                │            │
└──────────┴──────────────────────────────────────────────┴───────────┘
```

- **Three segments: Left, Right, Bottom.** Left & Right are full-height columns; Bottom sits under the
  stage, between the rails (the stage is "surrounded" — chosen layout **Y**).
- **Resize** by dragging the divider between a segment and the stage. **Collapse** a segment to zero
  (drag the divider all the way, or a collapse caret) → the stage reclaims the space. Collapse all three
  → the stage is full-screen.
- Each segment **scrolls** vertically; stack as many widgets as you like.
- **Centre stage** is never a segment — it's fixed and always present; only its *content* swaps
  (3D map ↔ 2D map ↔ world clock) via the top-bar switch or the palette.
- Segment sizes + collapsed state are **persisted** and **part of a preset**.

---

## 4. Widgets (category cards)

### 4.1 Shared frame (`<WidgetFrame>`)

Every widget renders inside one frame so the chrome is consistent:

- **Header:** icon · title · live count · freshness dot (e.g. "1m") · **alert badge** (count, red) ·
  `⋯` menu.
- **`⋯` menu:** Duplicate · Alert style (toggle A/B, see 4.3) · Resize-to-fit · **Remove**.
- **Toolbar (optional):** filter chips + sort control, per the widget's capabilities. Filter/sort is
  **per-instance** (two Aviation cards can filter to different regions).
- **"Needs attention" strip:** the widget's current alerts (4.3).
- **Body:** the widget-type's own content.
- **Drag handle** (the header): drag to reorder within a segment or move to another segment.
- **Resize handle** (bottom edge): adjust the widget's **height** (segments are 1-D scrolling stacks, so
  width = the segment's width; only height is user-set). A collapse caret shows header-only.

### 4.2 Multi-instance + per-instance config

- A widget is a `WidgetType`; the canvas holds `WidgetInstance`s. Adding the same type again creates a new
  instance with its own `config`. Example: Live News ×2 (Al Jazeera + Bloomberg); Aviation ×2 (Europe + US).
- Cap: **50 instances total.** Adding past 50 is blocked with a gentle inline nudge ("50-widget limit —
  remove one to add another").

### 4.3 The monitoring / alert model (v1 = curated rules)

Each `WidgetType` ships a pure **`alertRules(data, config) → Alert[]`** function — a handful of built-in
notable-change detectors. No user setup in v1.

- **Alert** = `{ id, severity: "info"|"warn"|"critical", text, ts, ref? }`.
- **Two display styles, per-card toggle (default A):**
  - **A — Alerts pinned on top:** a "Needs attention · N" strip above the live body.
  - **B — Priority feed:** one body stream sorted by importance; alerts float to the top with a priority dot.
- **Badge:** header shows the count of current alerts; the **segment** shows an aggregate badge so a
  collapsed/scrolled-away widget can still shout.
- **Deferred to later passes:** user-configurable thresholds, cross-widget correlation, and
  notify-when-not-looking (desktop / sound / tab-title). Captured in §10.

---

## 5. Command palette = the widget catalog

⌘K / Ctrl-K (already wired in `ConsoleShell`) becomes the catalog of everything addable:

- **Search** across widget types, presets, places, and commands.
- **Widget types grouped by category** (Aviation, News & Markets, Cameras, Events, Space, Maritime…).
  Each row: icon · name · short description · **Add** (creates an instance) · a small **count** of how many
  of that type are currently open.
- **Adding lands the widget in a segment automatically** (no segment picker — placement is loose by
  design); the user drags it wherever afterward. Default target: the segment with the most room / fewest
  widgets, falling back to Left.
- **Commands** (existing behaviour preserved): apply preset, switch stage (3D/2D/clock), switch basemap,
  fly to a region, open share.
- Respects the **50-instance cap**.

---

## 6. Presets

Presets *are* today's `Variant`, extended to carry the widget arrangement. Applying one **replaces** the
current arrangement.

- **Applying a preset sets:** the open widget instances + their segments/order/size, the segment
  sizes/collapsed state, the centre-stage choice, and (as today) map layers / signals / scope / theme /
  view.
- **Built-in presets (ship in slice):** `World` (all four widgets), `Aviation Ops` (Aviation + News +
  Cameras + Events), `Disaster Response` (Events + Cameras + News). More presets (e.g. Maritime Watch)
  arrive with their widgets in later passes — no empty presets in the slice.
- **Save your own:** "Save layout as preset…" snapshots the current arrangement into `userVariants`
  (already supported by `variantStore`), persisted to localStorage.
- **Unsaved-changes guard:** switching presets with unsaved edits prompts (the store already tracks an
  `edited`/override delta).
- **Share via URL:** extend the existing `share/url` encoder so a link restores the full arrangement
  (`?v=` preset + layout payload). Already have `?v=`/`?sig=` plumbing.

---

## 7. First-slice widgets (the 4)

Each reuses data the app already fetches.

| Widget | Body | Curated alert rules (examples) | Reuses |
|--------|------|--------------------------------|--------|
| **Live Video News** | Live **video** player + channel lower-third + `● LIVE`; **favourite tabs** for quick-switch + a **"More…" provider catalogue** (search + categories, ★ favourites) + **add-custom-stream** (HLS `.m3u8` / YouTube-live). Provider is **per-instance**. ~12 free 24/7 channels seeded (Al Jazeera, DW, France 24, Sky, Euronews, CNA, TRT, NHK, Bloomberg, NASA…). Muted by default, click to unmute, `⛶` expand. | (none in v1 — a "breaking" hook can come later) | `CameraVideo`/HLS player; news source list |
| **Aviation** | Filter/sort flights board (callsign, route, alt, speed, status). Filter by airline/region; sort by alt/speed. | squawk **7700/7600/7500**; rapid descent; new **military** callsign in region; airport traffic surge | `adsb.lol` plane layer (already live) |
| **Cameras** | Grid/list of live camera thumbnails/streams for the active region; click → dive. | camera went **offline**; new incident camera in region | existing HLS camera feeds + `CinematicDive` |
| **Disasters & Events** | The ranked event feed (filter by type/severity, sort by severity/time). | **M5+** quake; new **S3+** GDACS disaster; FIRMS cluster spike | the `EventFeed` projection you already built |

Stage widgets in slice: **3D map** (globe projection) and **2D map** (flat projection) — both available
from MapLibre's globe/flat projection (the app already renders the globe) — and a new **World Clock**
(multi-timezone).

---

## 8. Architecture (how it maps to existing code)

**Reused largely as-is**
- `variantStore` — presets, persistence (`tn.variant.v1`), URL share, `userVariants`, override deltas,
  `setActive`, `commitLayout`. Extend its persisted state with the widget arrangement.
- `layersStore` / `signalsStore` / `mapViewStore` / `scopeStore` / `uiStore` — preset application already
  flows through these.
- MapLibre `WorldMap` — 3D = globe projection, 2D = flat (existing). Becomes the stage's map widget.
- HLS player (`CameraVideo`) — basis for Live Video News + Cameras.
- `EventFeed` projection — wrapped as the Disasters & Events widget body.
- ⌘K `CommandPalette` shell + global shortcut.

**New / changed**
1. **Data model — `WidgetInstance` replaces one-per-key `PanelPlacement`.** This is the core change.
   ```ts
   type SegmentId = "left" | "right" | "bottom";
   type StageId = "map3d" | "map2d" | "clock";
   interface WidgetInstance {
     id: string;            // unique (nanoid)
     type: WidgetTypeId;    // "video-news" | "aviation" | "cameras" | "events" | …
     segment: SegmentId;
     order: number;         // position within the segment's scroll stack
     height: number;        // user-resizable; width = segment width
     collapsed?: boolean;
     config: Record<string, unknown>; // filter/sort, channel, region, alertStyle…
   }
   interface ShellLayout {
     segments: Record<SegmentId, { size: number; collapsed: boolean }>;
     stage: StageId;
     widgets: WidgetInstance[]; // ≤ 50
   }
   ```
   The current grid `PanelPlacement.grid{x,y,w,h}` is retired for this view in favour of
   segment + order + height (segments are 1-D scroll stacks, not a 2-D grid).
2. **`WidgetType` registry** — `{ id, title, icon, category, defaultConfig, defaultHeight, component,
   alertRules?, capabilities:{filter?,sort?,channels?} }`. Generalises today's `widgets/registry`
   (`rollup:`/`source:`) and the intel `PANEL_REGISTRY` into one typed registry that the palette and the
   segments both read.
3. **Shell stores** — `shellLayoutStore` (segment sizes/collapsed, stage, widget instances; persisted) and
   the drag/resize interactions. Segment dividers: a resizable-panels approach; intra/inter-segment widget
   drag: a vertical multi-container sortable (dnd-kit or equivalent). RGL is not needed for 1-D stacks.
4. **`<WidgetFrame>`** + the four widget bodies + the alert-rule functions.
5. **Live Video News** widget (channel list + player).
6. **World Clock** stage widget.
7. **Palette upgrade** — catalog rows with Add + instance counts + cap.

---

## 9. Reconciling existing chrome

- **Top bar:** keep; show active preset pill + stage switch + basemap + Scope + ⌘K + Share + lang + theme.
- **`viewMode` console/explore split:** retired — the segmented shell is the one view. "Explore the globe"
  becomes "collapse the segments / switch stage to 3D."
- **Old left Monitors (`SourceCatalog`) & right Events (`EventFeed`):** become widgets (Sources widget
  later; Events ships in slice).
- **`CinematicDive`** (fly-to-feed) and **`FeedOverlay`** dossier (`?obj=`): kept as drill-in overlays —
  clicking a row/camera dives or opens the dossier.
- **`BreakingBanner`:** kept for now (could fold into a widget later).
- **Bottom sources/paused bar:** folded into a slim status line or dropped (superseded by per-widget
  freshness).

---

## 10. Out of scope / later passes

- More widgets/categories: Maritime/Ships, Satellites/Space, Weather, Markets, Webcams, Sources, NOTAMs,
  Airports, Delays, Aviation-Wx, Helicopters, Military.
- **Smarter alerts:** user-configurable thresholds; cross-widget correlation; **notify-when-not-looking**
  (desktop notification / sound / tab-title badge).
- Mobile / small-screen layout (slice targets desktop console).
- Per-widget deep settings panels beyond filter/sort.

---

## 11. Assumptions & open questions

- **Assumption:** widget placement on add = "segment with most room, else Left." Loose by design; user
  confirmed they'll rearrange.
- **Assumption:** 50-instance cap is global (not per-type).
- **Assumption:** Live News = free public livestreams (YouTube-live/HLS). v1 seeds ~12 channels with
  favourite-tabs + a searchable provider catalogue + **add-custom-stream**; provider is per-instance; audio
  muted by default. Channel list is tunable.
- **Open:** intra-segment widget sizing — confirm height-only resize (vs. also a 2-col option in the wide
  Bottom segment). Default: height-only everywhere for v1.
- **Open:** does the Bottom segment span the **full width** (under the rails too) or only under the stage?
  Default: under the stage only (layout Y). Easy to switch.

---

## 12. Success criteria (slice)

1. Three segments resize, collapse to zero, and scroll; centre stage swaps 3D/2D/clock.
2. Add any of the 4 widgets from ⌘K; it appears in a segment; drag it to another segment; reorder; resize
   height; remove. Multi-instance works; 50-cap enforced.
3. Each widget shows live data + a working filter/sort and surfaces ≥1 curated alert in its strip/badge.
4. Live Video News plays a real livestream and switches channel.
5. Apply each built-in preset → the arrangement (widgets + segments + stage + layers) swaps wholesale.
6. Save a custom preset, reload → it persists; share a URL → it restores the arrangement.
7. `tsc` clean, unit tests for the pure pieces (layout reducers, alert rules, preset apply) green, build green.
