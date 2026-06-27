# PRD: Time-window filter
> Priority: P2 · Effort: M · Status: Proposed · Category: map-interaction

## 1. Summary
Add a single global "rolling time window" control (1h / 6h / 24h / 48h / 7d, plus Live) that scopes every history-bearing layer to a recent slice of time. Because TrafficNerd cameras are instantaneous snapshots, the window does NOT hide cameras — instead it (a) trims plane breadcrumb-trail length to "show motion within the last N", and (b) drives a new lightweight **Incidents** layer (ground stops / port-and-road closures) so only events whose timestamp falls inside the window render on the map, in the dossier, and in the bottom freshness ticker.

## 2. Why it matters for TrafficNerd
"What's been happening lately?" is the core transport question. A trail clipped to "last 1h" reads as recent intent; "last 7d" of incidents shows a region under stress. One control gives the dark ops console a temporal axis without a timeline scrubber, and makes the plane/incident layers feel like monitoring rather than a snapshot.

## 3. worldmonitor.app reference
worldmonitor exposes 1h/6h/24h/48h/7d ranges from the command palette; markers/events whose timestamp is outside the active window drop off the map and panels. We emulate the same range set and palette-reachability, and adapt the "drop off" behavior to trails + incidents.

## 4. How we build it (TrafficNerd-specific)

**State (new external store).** `lib/timeWindow.ts` — same `useSyncExternalStore` pattern as `lib/overlay.ts` / `lib/layers.ts`. Shape: `{ key: '1h'|'6h'|'24h'|'48h'|'7d'|'live' }`, exporting `timeWindow.set(key)`, `useTimeWindow()`, and a pure helper `windowMs(key): number | null` (`live` → null = no clamp). Persist last choice to `localStorage`.

**Plane trails.** `lib/planes/trail.ts` gains `clipHistoryByAge(history, maxAgeMs, now)`. Add `t: number` (epoch ms) to `TrailPoint` (stamped in `pushHistory`). In `usePlanes.ts`, before `buildTrailPath`, clip each plane's history with `windowMs(key)` from the store; `live` keeps the existing 12-point cap. Trails shorten/lengthen reactively when the window changes — no refetch.

**Incidents layer (new, keyless).** `lib/incidents/useIncidents.ts` polls a new closed proxy route `app/api/incidents/route.ts` that fetches and normalizes:
- **FAA NAS Status** `https://nasstatus.faa.gov/api/airport-status-information` (XML, keyless) → ground stops / ground delays, each with an issued/effective timestamp.
- **NHPMS / 511-style feeds are out of scope here**; v1 = airport ground stops only, normalized to `WorldObject{ kind:'incident', lat, lon, label, meta:{ ts, type, severity } }`.
Each fetch goes through the existing SSRF pattern (host+path allowlist, `redirect:'error'`, `AbortSignal.timeout`); the FAA host is added to the allowlist. Client receives normalized JSON only, never a raw upstream URL.

**Filtering.** `lib/world.ts` add `kind:'incident'`. New pure `lib/timeFilter.ts → withinWindow(obj, windowMs, now)` reads `obj.meta.ts`. `GlobeView.tsx`/`MapView.tsx` filter the incident `WorldObject[]` through it before building the MapLibre GeoJSON source; objects without a `ts` (cameras, satellites) are never filtered out.

**MapLibre.** One GeoJSON source `incidents`; a `circle`/`symbol` layer using existing SVG icons. No new map engine work — the filter happens in JS feeding `setData`.

**UI.** `components/TimeWindowControl.tsx` — a segmented pill in the top metrics bar (monospaced). Also register entries in the command palette ("Time window: 6h", etc.) and `lib/layers.ts` already toggles the incidents layer on/off.

**UX / states.** Active range highlighted; changing it animates trails. Empty: "No incidents in last 6h" in ticker + dossier. Loading: skeleton count. Error: keep last-good (like `usePlanes`). Keyboard: `[` / `]` step the window, `L` = Live; palette is `Cmd/Ctrl-K`.

## 5. Dependencies & prerequisites
- `command-palette` (for palette reachability) and `incidents-layer` if split out as its own PRD; otherwise this PRD includes a minimal incidents source.
- Reuses existing `lib/proxy` SSRF helper, `lib/icons`, plane trail module, overlay/layers stores. No new npm deps.

## 6. Risks & mitigations
- **FAA feed shape / availability:** wrap in `Promise.allSettled` + stale-cache fallback (mirror the camera registry); cache server-side ~60s to avoid hammering.
- **ToS/keyless:** FAA NAS Status is public US-gov data; attribute it in `AttributionBadge`.
- **Perf:** filtering is O(incidents) (hundreds, not thousands) per window change; trail clipping is already per-plane. No re-render storm — store change updates only consumers.
- **Clock skew:** use server-provided `ts`; compare against `Date.now()` tolerantly.

## 7. Acceptance criteria
- [ ] `lib/timeWindow.ts` store + `windowMs()` unit-tested; choice persists across reload.
- [ ] Switching to 1h visibly shortens plane trails; switching to 7d lengthens them; `live` matches current behavior.
- [ ] Incidents outside the window disappear from map + dossier + ticker; cameras/satellites unaffected.
- [ ] `/api/incidents` returns normalized JSON, never an upstream URL; FAA host allowlisted; `redirect:'error'` + timeout present.
- [ ] Control reachable from both the top bar and Cmd/Ctrl-K; `[` `]` `L` keys work.
- [ ] Empty/loading/error states render; fetch failure keeps last-good.

## 8. Out of scope / future
Historical playback/scrubber, ship/port-closure feeds, per-layer independent windows, server-side time-series storage, and density heatmaps over time.
