# Intel Widgets — Design Spec

**Date:** 2026-06-27 · **Branch:** `feat/intel-widgets`

## Goal

Surface the live data TrafficNerd already pulls as **dockable data widgets**, the
way WorldMonitor does — so the depth is visible at a glance, not trapped behind a
click on the map. Four widgets, all deterministic and fed by existing
`/api/signals/<id>` endpoints (no new API keys for the flagship set):

1. **Country Instability** — ranked CII list (country · score/100 · drivers · coverage).
2. **Armed Conflict** — ACLED event table when creds are set; keyless GDELT
   conflict coverage as the live fallback. Honestly labelled which.
3. **Top Events / Live Now** — strongest quakes, biggest fires, newest disasters,
   merged across hazard sources, zero-click.
4. **Strategic Risk** — an aggregate risk gauge derived from the CII + a live
   per-group signal-count strip.

## Why

User: *"look at world monitor … how much data and statistics they have on show …
Lets get more widgets."* The viz review found all the real data lives behind a
click. We already pull the matching sources (`instability`, `acled`/`conflict`,
USGS/EMSC/FIRMS/EONET/GDACS, `signalCounts`); this milestone shows them.

## Architecture (drops into the SP1b dockable workspace)

Each widget is a **dock panel** following the existing `MarketsPanel` idiom:
`export default function XPanel({ docked = false }: { docked?: boolean } = {})`,
`active = open || docked`, fetch-on-active + poll, `.tn-docked` when docked,
`role="region"`. Pure data mappers are node-tested; components verified by build.

**Shared:**
- `lib/widgets/useSignalFeatures.ts` *(client hook)* — `useSignalFeatures(id, enabled)`
  fetches `/api/signals/<id>`, polls on an interval, returns
  `{ features: SignalFeature[]; status: "idle"|"loading"|"error" }`. Dormant-safe.
- `lib/widgets/openSignal.ts` *(pure-ish)* — `openSignalFeature(f, source)` builds a
  `WorldObject` (`kind:"signal"`) from a `SignalFeature` and calls
  `overlay.open(...)` + `mapViewStore.flyToPoint({lat,lon,zoom})`. The row-click
  action shared by every widget. (The `WorldObject` builder is the pure, tested part.)

**Per widget:** a pure rows mapper in `lib/widgets/<x>.ts` + a
`components/shell/<X>Panel.tsx` + a `PanelKey` + `PANEL_REGISTRY` entry + an entry
in `DockableWorkspace`'s `DOCKABLE` set + a dock placement in the `intel` variant.

**PanelKey extension** (`lib/variants/types.ts`): add
`"instability" | "conflict" | "topEvents" | "risk"`.

**Variant:** dock all four (plus existing brief/markets) in the **`intel`** variant
→ a dense "situation-room" right column. `intel` becomes the WorldMonitor-style view.

## Data → widget mapping (verified against the sources)

- **Country Instability** ← `/api/signals/instability` → `SignalFeature[]` already
  **sorted by score desc**, `props: { country, score, drivers, coverage }`. Keyless
  (food/displacement/outages live; conflict factor needs ACLED). Rows: country,
  score (colour ramp via `instabilityColor`), drivers, coverage.
- **Armed Conflict** ← `/api/signals/acled` (rich: `props.eventType/country/fatalities/date`)
  with keyless `/api/signals/conflict` GDELT fallback (`props.place/articles/window`).
  The mapper picks ACLED when non-empty, else GDELT, and reports which.
- **Top Events** ← merge `/api/signals/earthquakes`, `/api/signals/fire-firms`,
  `/api/signals/gdacs`, `/api/signals/wildfires` → take top N by a per-source
  severity key (`props.magnitude`), newest-first tiebreak on `ts`.
- **Strategic Risk** ← `/api/signals/instability`: aggregate = mean of the top-N CII
  scores (a transparent global index) + trend placeholder "—" (no history yet) +
  a live count strip from `signalCountsStore` (currently-ON groups).

## Interaction

Every row is a button: click → `openSignalFeature(feature, sourceLabel)` →
fly the globe to it + open the existing signal dossier. Honest by construction —
each widget shows its source label + a "last updated" age, and renders a calm
"No data right now" / "Add ACLED creds to enable" state when dormant (mirrors
`MarketsPanel`'s dormant copy). Calm light tokens only, no neon.

## Testing

- **Unit (vitest node):** the pure mappers — `instabilityRows`, `conflictRows`
  (ACLED-vs-GDELT selection + empty), `topEventsRows` (merge + cap + sort),
  `riskSummary` (mean of top-N, empty → 0), and the `WorldObject` builder in
  `openSignal`.
- **Build + Playwright:** widgets render in the `intel` dock, rows are clickable,
  dormant states show, console clean.

## Scope / YAGNI

- No new data sources or API keys for the flagship set (GDELT keyless covers
  conflict when ACLED is dormant). Airline-delay / travel-advisory widgets are
  **out** (would need new sources) — noted for later.
- Trend arrows need history we don't store yet → show "—" not a fake delta.
- Widgets are dock tiles in `intel`; a ⌘K "open widget" command is a nice-to-have,
  added only if cheap.

## Build order

1. Shared `useSignalFeatures` + `openSignal` (+ `WorldObject` builder test).
2. `PanelKey` extension + registry + `DOCKABLE` + `intel` dock scaffold.
3. Country Instability (flagship) → end-to-end.
4. Armed Conflict → 5. Top Events → 6. Strategic Risk.
7. CSS + final gate.
