# PRD: Dark ops-console shell (panel grid)
> Priority: P0 · Effort: L · Status: Proposed · Category: ui-shell

## 1. Summary
Build the dense, dark, monospaced-numerics situational-awareness shell that frames the whole app: a full-bleed MapLibre map flanked by a grid of modular intelligence panels (Aircraft, Cameras, Satellites, Incidents, Status), grouped into Critical / Primary / Supporting / Reference tiers. Panels are draggable to reorder, collapsible to header-only, and show/hide-able from a Settings menu — and crucially, **a hidden panel does not mount, fetch, or tick**, so we never pay for 3,300 cameras or live ADS-B feeds the user can't see. The full layout (order, collapsed, hidden, theme, fullscreen) persists in `localStorage`. Outcome: TrafficNerd's decided "Bloomberg Terminal for transport" chrome, replacing today's single floating `LayerControl` + `FeedOverlay` over a globe.

## 2. Why it matters for TrafficNerd
A transport-monitoring tool lives or dies on *information density at a glance*. The shell is what turns four disconnected data layers (live CCTV, ADS-B aircraft, SGP4 satellites, incidents) into one cohesive ops console: glance left for "342 aircraft tracked / 41 over London," watch the map center, click any object for its dossier on the right. The hidden-panels-don't-fetch rule is the difference between an instant-load portfolio piece and a tab that hammers four upstreams on every visit. It also gives the user the agency a dense console needs — hide Satellites, pin Cameras, collapse Status — without losing their setup between sessions.

## 3. worldmonitor.app reference
worldmonitor renders a map plus a reorderable grid of panels (Strategic Risk, Live Intel, Markets, News) grouped Critical/Primary/Supporting/Reference. Each panel has a header grip for drag-to-reorder, a Settings menu to show/hide (hidden = not rendered, not fetched), and a collapse control to header-only (collapsed panels still refresh). Layout persists in localStorage; the shell offers a dark/light toggle and fullscreen. We emulate the grid + grouping + persistence + hidden-don't-fetch behavior, but the panels are transport intel, not finance.

## 4. How we build it (TrafficNerd-specific)

**Data sources & APIs.** The shell itself fetches nothing — it *gates* the existing keyless adapters. Each panel owns its data via the current hooks/registry: cameras through `lib/sources/registry.ts` (TfL/Caltrans/SCDOT/Digitraffic via `/api/proxy` + `/api/hls`), aircraft through `lib/planes/usePlanes.ts` (adsb.lol), satellites through `lib/satellites/useSatellites.ts` (CelesTrak TLE + satellite.js). The client still never receives a raw `streamUrl`; panels render the same `WorldObject` shape from `lib/world.ts`.

**State (new external stores, same `useSyncExternalStore` pattern as `lib/overlay.ts` / `lib/layers.ts`):**
- `lib/shell/panels.ts` — `PanelKey = "aircraft" | "cameras" | "satellites" | "incidents" | "status"`; per-panel `{ visible, collapsed, order, tier }`. Actions: `reorder`, `toggleVisible`, `toggleCollapsed`, `reset`. **The crucial contract: a panel mounts its data hook only when `visible === true`** — collapsed panels stay mounted and keep ticking (header-only), hidden panels unmount so their `useEffect` fetch/interval tears down.
- `lib/shell/persist.ts` — debounced read/write of panel state + `theme` + `fullscreen` to `localStorage` key `trafficnerd.shell.v1`, with a schema-version guard (bump → `reset()`), wrapped in try/catch for private-mode/SSR safety. Hydrate on mount only (avoid SSR mismatch — render defaults server-side, reconcile client-side).
- `lib/shell/theme.ts` — `"dark" | "light"`, default dark; toggles a `data-theme` attr on `<html>` consumed by CSS variables in `app/globals.css`.

**Components to ADD:**
- `components/shell/ConsoleShell.tsx` — top metrics/status bar, left layer rail, the panel grid region, the map slot (children), the bottom freshness ticker. Owns keyboard + fullscreen.
- `components/shell/PanelGrid.tsx` — CSS-grid of `<Panel>`s ordered by tier then `order`; drag-to-reorder via native HTML5 DnD on the header grip (no new dep), `onDrop` calls `panels.reorder`.
- `components/shell/Panel.tsx` — header (grip, title, live count badge, collapse caret, ✕ hide), body slot; renders body only when `!collapsed && visible`.
- `components/shell/SettingsMenu.tsx` — checkbox list to show/hide panels + "Reset layout."
- `components/shell/TopBar.tsx`, `components/shell/FreshnessTicker.tsx` (per-source last-updated + stale flag, reading registry timestamps).
- Panel bodies: `components/shell/panels/AircraftPanel.tsx`, `CamerasPanel.tsx`, `SatellitesPanel.tsx`, `IncidentsPanel.tsx`, `StatusPanel.tsx` — each a thin wrapper that mounts its hook + lists/sorts its `WorldObject`s, clicking a row calls the existing `overlay.open(obj)`.

**Files to CHANGE:** `app/page.tsx` (wrap `<MapView/>` in `<ConsoleShell>`; keep `<FeedOverlay/>` as the right dossier); `app/globals.css` (CSS-variable theme tokens, monospace numerics via `font-variant-numeric: tabular-nums`); migrate `components/LayerControl.tsx` into the left rail of `ConsoleShell` (reuse its toggle UI, feed counts in). `app/layout.tsx` sets default `data-theme="dark"`.

**UX & states.** Loading: panel shows a skeleton + spinner badge. Empty: "No aircraft in view." Error: inline "Source unavailable — retry" using registry stale-cache fallback (show last-good + a stale dot). Keyboard: `Ctrl/Cmd-K` command palette (stub that focuses panel toggles for v1), `F` fullscreen, `Esc` closes dossier/palette, panels reorderable via grip with `aria-grabbed`. Respect `prefers-reduced-motion`.

**SSRF/proxy.** No new outbound calls; all cross-origin fetches keep flowing through the existing allowlisted `/api/proxy` and `/api/hls`. The shell only adds the *gate* that prevents hidden panels from fetching at all.

## 5. Dependencies & prerequisites
- `single-maplibre-engine` (the `projection:'globe'` MapView rebuild) — the shell wraps it; until then it wraps the current `GlobeView`. No hard block on layout work.
- Existing `lib/sources/registry.ts`, `lib/world.ts`, `lib/overlay.ts`, `lib/layers.ts`, `lib/planes`/`lib/satellites` hooks. No new npm dependency (native HTML5 DnD, `useSyncExternalStore`).

## 6. Risks & mitigations
- **Fetch storms** if all panels mount at once → hidden panels unmount their hooks; throttle visible-panel intervals through the registry's shared cache so multiple panels share one fetch.
- **Perf with thousands of cameras** → panels render virtualized/Top-N lists (e.g. nearest 100 in viewport), not all 3,300; the map remains the dense renderer.
- **localStorage corruption / SSR mismatch** → schema-version guard + try/catch + hydrate-after-mount.
- **DnD fragility on touch** → grip-only drag, keyboard reorder fallback, `Reset layout` escape hatch.
- **ToS/rate limits** unchanged — same keyless sources, same SSRF allowlist; hidden-don't-fetch *reduces* upstream load.

## 7. Acceptance criteria
- [ ] Map renders full-bleed with top bar, left rail, panel grid, and bottom ticker; dark by default.
- [ ] Panels grouped Critical/Primary/Supporting/Reference; draggable to reorder via header grip.
- [ ] Hidden panel does not mount, **does not fetch, and fires no interval** (verify: no network/console activity while hidden).
- [ ] Collapsed panel shows header + live count and **keeps refreshing**.
- [ ] Layout (order/collapsed/hidden), theme, and fullscreen persist across reload via `localStorage`; `Reset layout` restores defaults.
- [ ] Clicking a panel row opens the existing right-side dossier (`overlay.open`).
- [ ] `Ctrl/Cmd-K`, `F` (fullscreen), `Esc` work; light/dark toggle works; `prefers-reduced-motion` honored.
- [ ] No raw `streamUrl` reaches the client; all cross-origin fetch still via `/api/proxy` + `/api/hls`.
- [ ] Vitest covers `panels.ts` (reorder/toggle/hidden-unmount intent) and `persist.ts` (round-trip + version-guard).

## 8. Out of scope / future
Multi-window / pop-out panels; resizable/free-form drag (vs grid reorder); per-panel custom refresh intervals UI; a full command-palette search index (v1 ships a focus-stub); saved layout presets / cloud sync; the Vessels/AIS panel (deferred until a keyless ship source lands).
