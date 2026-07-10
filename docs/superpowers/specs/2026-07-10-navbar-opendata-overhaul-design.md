# Navbar / OpenData overhaul — design

**Date:** 2026-07-10 · **Status:** approved · **Branch:** `feat/navbar-opendata-overhaul`

## Context
The top bar (`components/shell/StatusBar.tsx`) has grown crowded and mixes two
overlapping board-selection systems: the older **variants** switcher (the top-left
"Intel · edited" pill, `VariantSwitcher` + `lib/variants/*`) and the newer **presets**
system (`lib/console/presets.ts` → `applyPreset`, which already swaps *both* widgets and
world overlays) that is buried in the ⌘K palette. This overhaul rebrands to **OpenData**,
retires the navbar variant pill in favour of a single central **presets pill**, moves the
map-view controls onto the map, consolidates utilities into a **Settings** drawer, adds a
**profile** menu, and adds an ambient **cinematic world clock** over the map.

## Scope / milestones (one branch, one PR)
Committed in coherent units (each gated by `npx tsc --noEmit && npm test` + a Playwright
screenshot to `persona-shots/`):

### M1 — Presets → 5 broad boards
Rewrite `BUILTIN_PRESETS` (`lib/console/presets.ts`) from 11 personas to **5** whose
widget union touches every widget group (core + all signal groups). Update
`DEFAULT_PRESET_ID` and the preset unit tests. No UI change; ⌘K + first-run seed keep
working through the same `applyPreset`. The 5 boards:

| id | title | icon | stage | widgets (segment) |
|----|-------|------|-------|--------------------|
| `overview` | World Overview | 🌐 | map2d | instability(L) events(L) · cameras(R) markets(R) · headlines(B) |
| `situation` | Situation Room | 🎯 | map2d | instability(L) conflict(L) · acled(R) protests(R) · military-air(B) displacement(B) news(B) |
| `earth` | Earth Systems | 🌍 | map2d | gdacs(L) earthquakes(L) · wildfires(R) floods(R) · tropical-cyclones(B) weather(B) airquality(B) |
| `mobility` | Air · Sea · Space | 🛰 | map3d | aviation(L) satellites(L) · ais(R) ports(R) · launches(B) aurora(B) cables(B) |
| `markets` | Markets & Cyber | 📈 | map2d | markets(L) headlines(L) · cyber-c2(R) cyber-ransomware(R) · internet-outages(B) grid-load(B) |

`DEFAULT_PRESET_ID = "overview"`.

### M2 — Navbar overhaul + Settings drawer + Profile menu
`StatusBar.tsx` reshaped left→right:
`OpenData` wordmark · live pulse · **central presets pill** · `⌘K` · **profile avatar** · **settings gear**.
- Wordmark: **Open**Data (reuse `.tn-wordmark` / `.tn-wordmark-accent`).
- Remove `<VariantSwitcher/>` from the bar (keep the component + its unit test; just unmount it).
- **Central presets pill** — new `components/shell/PresetPill.tsx`: shows active board, dropdown of the 5, calls `applyPreset(id)`. Tracks active id in a tiny persisted store (`lib/console/activePreset.ts`) so the pill reflects the current board.
- **Settings drawer** — new `components/shell/SettingsPanel.tsx` (right slide-over, scrim, Esc-close): Language (`langStore`), Dark mode (`uiStore.toggleTheme`), Share layout (`copyShareLink`/`?c=`), Load preset board (the 5 + custom `listPresets`/`applyPreset`). Move lang/theme/share **out** of the navbar into here.
- **Profile menu** — new `components/shell/ProfileMenu.tsx` (avatar popover): local display name (persisted, drives avatar initial + colour), **"Sign in"** placeholder (opens a stub modal — no real OAuth yet; seam left for later), link to Settings.
- **Map-view controls relocate** to a floating cluster at the map stage top-right — new
  `components/console/MapControls.tsx` mounted inside `.tn-cw-stage`
  (`components/console/ConsoleWorkspace.tsx`), holding the **3D/2D** switch (repurposed
  `StageSwitch`, clock option dropped) + the **basemap** segmented control. Gated by
  `showMapOverlays` (not focused, stage is a map) so it hides when a widget is fullscreened.

### M3 — Cinematic world clock
New ambient multi-city day/night clock (`components/console/WorldClock.tsx` reworked, or a
new `WorldClockOverlay`) rendered as an overlay inside `.tn-cw-stage`, gated by the same
`showMapOverlays`. Retire the old full-screen `clock` **stage**: drop the clock button from
the view switch and fall back `stage === "clock"` → map in `StageHost.tsx`.

## Key reuse
- `applyPreset` / `layersForLayout` — already swaps widgets + core + signal layers.
- `uiStore` (theme), `langStore` (i18n), `copyShareLink` (share), `mapViewStore` (basemap).
- `shellLayoutStore.focusedWidgetId` — the fullscreen signal for hiding map overlays.
- `loadPersisted`/`savePersisted` — for the tiny active-preset + profile stores.
- `.tn-cw-stage` is already inset by the column vars, so its top-right corner is the
  visible map corner; MapLibre zoom controls stay bottom-right.

## Verification
`npx tsc --noEmit && npm test` after each milestone; `npm run build` before PR. Playwright
screenshots per milestone (navbar, open settings drawer, profile menu, each preset board,
clock overlay, focused-widget hides overlays). Confirm: switching the central pill re-skins
both widgets and map overlays; theme/lang/share still work from Settings; clock + map
controls vanish when a widget is fullscreened.
