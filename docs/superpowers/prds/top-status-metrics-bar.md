# PRD: Top status / metrics bar
> Priority: P0 · Effort: M · Status: Proposed · Category: ui-shell

## 1. Summary
A persistent, always-on top bar that renders the live global pulse of TrafficNerd: aircraft airborne, cameras online/total, satellites overhead, each with a compact monospaced number, a directional trend arrow (vs ~1h ago), plus a single global "data health" badge. It is the first shell chrome to land, establishing the dark ops-console frame the rest of the UI (left rail, dossier panel, ticker, palette) docks into.

## 2. Why it matters for TrafficNerd
The map answers "where"; the status bar answers "how much, and is it healthy" at a glance, with zero clicks. A viewer landing cold sees within seconds that thousands of cameras are online and hundreds of planes are airborne — proof the app is live, not a screenshot. Trend arrows turn static totals into a sense of motion (more flights than an hour ago), and the health badge surfaces silent source failures (e.g. a Caltrans outage) instead of hiding them behind empty map regions.

## 3. worldmonitor.app reference
worldmonitor's header packs Top Signals, a DEFCON indicator, a FOCUS selector, a SOURCES button, and aggregate counters ("Up 7/11", "3 of 13 disrupted") in compact monospaced numerics with up/down/stable arrows. We adapt the aggregate-counter + trend-arrow + health-indicator pattern; FOCUS region and SOURCES feed-manager are deferred to their own PRDs (this bar only links to them).

## 4. How we build it (TrafficNerd-specific)
**Data — reuse existing layers, no new fetches.** The live counts already exist client-side: `pts.length` / `filteredCameras.length` (cameras), `useSatellites().length`, `usePlanes().objects.length`. We lift these into a tiny external store so the bar and `GlobeView` share one source of truth.

**Files to ADD**
- `lib/metrics.ts` — `useSyncExternalStore` store (mirrors `lib/layers.ts`/`lib/overlay.ts`). Shape: `{ camerasOnline, camerasTotal, planes, satellites, sources: {id, ok, ageMs}[] }` via `metricsStore.set(partial)`. Also keeps a rolling ring buffer of `{t, planes, camerasOnline}` snapshots (capped, persisted to `sessionStorage`) and exposes `trend(metric)` → `'up'|'down'|'flat'` by comparing now vs the oldest snapshot ≥55min old.
- `components/StatusBar.tsx` — `"use client"`, subscribes via `useMetrics()`, renders metric cells + `<HealthBadge>`. Fixed top, `tabular-nums` monospace, directional `▲▼▬` glyphs coloured green/red/slate.
- `app/api/health/route.ts` — `force-dynamic`; calls `getRegistry()` and returns per-source `{ id, count, ok, ageMs }` derived from the registry cache + `Promise.allSettled` outcomes (planes/sats health stays client-side from last-poll timestamps).

**Files to CHANGE**
- `components/GlobeView.tsx` — replace local count usage with `metricsStore.set(...)` in the existing `useMemo`/effects (cameras online = `available && live`, totals from registry); push plane/sat poll timestamps for staleness.
- `app/page.tsx` — render `<StatusBar />` above `<GlobeView />`; add top padding so the globe/map canvas clears the bar.
- `app/globals.css` — bar tokens (height, `--bar-bg`, mono font stack).

**UX & states.** Loading: cells show `––` with a subtle pulse until first data. Empty/error per metric: greyed `0` (not blank) so a dead layer is visible. Health badge: green "LIVE" when all sources fresh, amber "DEGRADED" when ≥1 source stale/failed (tooltip lists which), red "OFFLINE" when registry throws. Each cell is keyboard-focusable; Enter toggles that layer via `layersStore` (bar doubles as a quick toggle). Counts respect active filters (online = post-`cameraFilter`).

**SSRF.** No client cross-origin calls — counts come from already-proxied data and `/api/health`, which only calls server-side `getRegistry()`. Client never sees a raw `streamUrl`.

## 5. Dependencies & prerequisites
- Reuses `lib/sources/registry.ts`, `lib/layers.ts`, `usePlanes`, `useSatellites`, `cameraFilter`. No new npm deps.
- Soft pairs with `region-focus-selector` and `sources-feed-manager` PRDs (bar exposes hooks/buttons for them later) but does not block on either.

## 6. Risks & mitigations
- **Trend needs history the page doesn't have on first load** → arrows render `flat`/hidden until a ≥55min-old snapshot exists; persist ring buffer in `sessionStorage` so reloads keep history.
- **Re-render storm** (planes poll 12s, sats tick 1s) → store batches via shallow-equal `set`; bar reads scalars only, never the object arrays.
- **Health false-alarms** → treat a source as stale only past its TTL (registry 5min) plus grace; show amber, never hard-fail the bar.
- **No rate-limit/CORS/ToS exposure** — uses existing allowlisted server paths.

## 7. Acceptance criteria
- [ ] Top bar persists across globe and street-map zoom; canvas never hidden behind it.
- [ ] Cameras (online/total), planes airborne, satellites overhead show live monospaced counts matching the layers.
- [ ] Each metric shows ▲/▼/▬ vs ~1h ago; survives reload via `sessionStorage`.
- [ ] Health badge flips green→amber when a camera source is killed (verify by forcing one `fetchRegistry` to reject).
- [ ] Loading shows `––`; a dead layer shows `0`, not blank.
- [ ] Enter on a focused cell toggles that layer; no client receives a raw `streamUrl`.
- [ ] `npm run build` + existing vitest suite pass; one new unit test for `metrics.trend()`.

## 8. Out of scope / future
Vessels/ships counter (no AIS layer exists yet — add when a maritime source lands), Top Signals breaking-incident strip, FOCUS region selector and SOURCES feed manager (own PRDs), DEFCON-style global threat index, sparklines, and historical charts beyond the single 1h arrow.
