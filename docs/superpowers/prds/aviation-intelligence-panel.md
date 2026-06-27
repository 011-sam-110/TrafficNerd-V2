# PRD: Aviation intelligence panel
> Priority: P2 · Effort: L · Status: Proposed · Category: data-layer

## 1. Summary
A dedicated, multi-tab **Aviation Intelligence** panel that elevates TrafficNerd from "plane dots + a per-flight dossier" to a domain console. Opened from the left layer rail (or `A`), it slides in over the live globe and presents aggregate and per-entity aviation state across tabs — **Ops** (live airborne stats), **Flights** (searchable in-coverage list), **Airports** (delay/closure status), **Airframe/Route** (the selected flight's enrichment), and **Tracking** (telemetry + altitude sparkline). It reuses the data layer the flight-tracking PRD ships (adsb.lol positions, adsbdb enrichment, FAA delays) and adds no new upstreams — this is the presentation/aggregation tier, not a new feed.

## 2. Why it matters for TrafficNerd
The per-plane dossier answers "what is this one dot?" The aviation panel answers "what is the airspace doing right now?" — the worldmonitor-style situational-awareness payoff that makes the app feel like an ops console rather than a map toy. It turns hundreds of moving objects into a readable picture: how many are airborne, how many military, which monitored airports are delayed or closed, and which flight is selected with its route on the globe. It also models the pattern we will copy for the maritime and satellite domains (one domain → one multi-tab panel), so it is foundational to the console's information architecture.

## 3. worldmonitor.app reference
worldmonitor ships a 6-tab "Aviation Intelligence" panel (Ops, Flights, Airlines, Tracking, News, Prices) over 111 monitored airports across 5 regions, with NOTAM closure detection and three independent delay sources (FAA ASWS, AviationStack, ICAO NOTAM). We emulate the **multi-tab domain-panel shape and the multi-source delay redundancy**, but adapt the tab set to what keyless data actually supports: we keep Ops, Flights, Airports (worldmonitor's NOTAM/delay surface), Airframe/Route, and Tracking; we **drop Airlines and Prices** (require keyed commercial APIs) and reduce News to an optional keyless RSS strip (see §8).

## 4. How we build it (TrafficNerd-specific)

**Data sources (keyless, all server-side).** No new feeds. Reuse: `lib/sources/adsb.ts` (positions), `lib/sources/adsbdb.ts` (callsign→route, hex→airframe/photo), `lib/sources/faaDelays.ts` (FAA NAS Status `https://nasstatus.faa.gov/api/airport-status-information`). A small static `lib/airports/registry.ts` (ICAO/IATA, name, lat/lon, region) supplies the monitored-airport list for the Airports tab so it shows entries even when no delay is active.

**State / stores.** Add `lib/aviationPanel.ts` — the same framework-light external-store + `useSyncExternalStore` pattern as `lib/overlay.ts`/`lib/layers.ts`: `{ open: boolean; tab: AviationTab; focusHex: string | null }` with `open()/close()/setTab()/focus(hex)`. Clicking a plane both opens the existing `overlay` dossier **and** sets `focusHex`, so the panel's Airframe/Route/Tracking tabs reflect the selection. Aggregate stats (Ops tab counts, busiest region) are derived from the live `usePlanes()` WorldObject array — pure selectors in `lib/planes/stats.ts`, no extra fetch.

**Components.** Add `components/AviationPanel.tsx` (shell: tab bar + body + close, focus-trapped), and tab bodies `components/aviation/OpsTab.tsx`, `FlightsTab.tsx`, `AirportsTab.tsx`, `AirframeTab.tsx`, `TrackingTab.tsx`. `FlightsTab` is a virtualized, filterable list (callsign/type/mil) whose rows call `aviationPanel.focus(hex)` + fly the map to that plane. `TrackingTab` draws an altitude/speed sparkline from the existing breadcrumb trail (`lib/planes/trail.ts`) — no new data. Wire a panel toggle into `components/LayerControl.tsx`/the left rail and the command palette.

**MapLibre integration.** The panel drives existing layers, it does not add map sources of its own: selecting a flight reuses the flight-tracking `plane-route` source; the Airports tab toggles the `airport-delays` circle layer and flies to a clicked airport.

**SSRF/proxy.** The panel renders only data already laundered through our `/api/*` routes (`/api/aircraft/[hex]`, `/api/delays`); the airframe photo still goes through the existing image proxy (`lib/proxy/allowlist.ts`, `proxy?url=`). No raw upstream URL or streamUrl reaches the client.

**UX/states.** Slide-in from the left (mirrors the right dossier), `Esc` closes, arrow/`Tab` move between tabs, deep-linkable via the shareable-deep-links query (`?panel=aviation&tab=airports`). Loading = skeleton rows + dimmed counts; empty = "no aircraft in coverage" / "no active delays"; error = last-good retained (hook behavior), with a stale-age note from the freshness ticker.

## 5. Dependencies & prerequisites
- **`flight-tracking`** (this is the consumer of its `adsbdb`/FAA fetchers, military flag, and `plane-route` layer) — build that first.
- `dark-ops-console-shell` and `left-layer-rail` (panel chrome + toggle host).
- `shareable-deep-links` (panel/tab deep links) and `data-freshness-ticker` (stale-age display) — soft deps.
- No new npm dependencies.

## 6. Risks & mitigations
- **Re-render cost from live data:** Ops/Flights derive from `usePlanes()` every poll — keep selectors memoized, virtualize the Flights list, and throttle stat recompute to the poll interval (not per frame).
- **adsbdb rate limits:** enrichment stays click/focus-triggered and server-cached (per flight-tracking); the panel never bulk-enriches the whole list.
- **Delay-source fragility / single feed:** FAA only is acceptable for v1; tolerate schema drift with defensive parsing and degrade to "delay data unavailable." Multi-source redundancy is structured behind one `AirportStatus` shape for later sources.
- **Scope creep vs the dossier:** the panel is domain-aggregate; per-object detail stays in the right dossier to avoid duplication.
- **ToS/attribution:** credit adsb.lol, adsbdb, FAA in `AttributionBadge`.

## 7. Acceptance criteria
- [ ] An Aviation toggle opens a left slide-in panel with Ops / Flights / Airports / Airframe / Tracking tabs; `A` and the command palette open it; `Esc` closes.
- [ ] Ops tab shows live counts (total airborne, military, busiest region, avg altitude) that update each poll.
- [ ] Flights tab lists in-coverage aircraft, is filterable, and clicking a row focuses that flight (map fly-to + Airframe/Route/Tracking populate).
- [ ] Airports tab lists monitored airports with delay/closure status colored by severity; clicking one flies the map there.
- [ ] Airframe tab shows registration, type, and photo (via image proxy); Tracking tab shows an altitude/speed sparkline from the breadcrumb trail.
- [ ] Loading/empty/error states render per §4; no raw upstream URL reaches the client.
- [ ] `?panel=aviation&tab=...` deep link restores the panel + tab.
- [ ] `lib/planes/stats.ts` selectors and `lib/aviationPanel.ts` are unit-tested; `npm test` green.

## 8. Out of scope / future
Airlines tab and ticket Prices (need keyed commercial APIs); full ICAO/FAA NOTAM parsing (needs credentialed APIs) — closures limited to keyless FAA NAS Status for now; AviationStack/ICAO as redundant delay sources; aviation News RSS strip; historical flight replay; non-US monitored-airport delay coverage.
