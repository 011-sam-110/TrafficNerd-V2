# PRD: Live flight / aircraft tracking
> Priority: P1 · Effort: L · Status: Proposed · Category: data-layer

## 1. Summary
Promote aircraft from "a layer that exists" to TrafficNerd's flagship live transport layer. The base — real-time ADS-B positions from keyless `adsb.lol`, ADS-B-emitter-category classification, breadcrumb trails, and a poll hook — already ships (`lib/sources/adsb.ts`, `lib/planes/*`, `app/api/planes/route.ts`). This PRD adds the three things that make it competitive with worldmonitor: (a) on-click **route + airframe enrichment** via `adsbdb` (callsign→origin/destination airports, hex→registration/type/photo), (b) a **Military vs Civil split** as independent toggles with distinct icons, and (c) an **Airport Delays** overlay. Outcome: planes update within seconds of load, clicking one opens a rich dossier with its route drawn on the globe, and military traffic + congested airports are first-class, toggleable layers.

## 2. Why it matters for TrafficNerd
Aircraft are the most visually alive transport layer — hundreds of objects moving every second across the same globe as the 3,300 cameras and the satellites. The dossier (origin→destination airports with lat/lon, registration, aircraft photo, real route line) turns a moving dot into a comprehensible journey, which is the core "monitor the world's transport" promise. The military split surfaces the most-watched traffic (tankers, ISR, transports) that civil flight apps bury, and the delays overlay ties air traffic back to ground reality.

## 3. worldmonitor.app reference
worldmonitor renders ADS-B traffic (OpenSky/Wingbits) as a live aircraft layer, exposes a **separate Military Flights layer**, and ships an **FAA airport Delays layer** (Ground Stop / Ground Delay / Arrival / Departure) with severity thresholds and color coding. Positions stream in as the page loads. We emulate the military-split + delays-overlay pattern but on our own keyless stack.

## 4. How we build it (TrafficNerd-specific)

**Data sources (keyless).**
- Positions: existing `https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{nm}` per region (`ADSB_REGIONS`). No change.
- Enrichment (NEW): `adsbdb` — `https://api.adsbdb.com/v0/callsign/{callsign}` (→ origin/destination airport + lat/lon) and `https://api.adsbdb.com/v0/aircraft/{hex}` (→ registration, type, owner, **photo URL**). Both keyless.
- Delays (NEW): FAA NAS Status JSON `https://nasstatus.faa.gov/api/airport-status-information` (keyless XML/JSON); parse Ground Stop/Ground Delay/Arrival/Departure programs to a small `AirportDelay[]`.

**Military detection.** `lib/planes/classify.ts` already maps ADS-B emitter categories; add `lib/planes/military.ts` — a pure predicate using (1) ADS-B-category B/C/D + known military type codes (`KC135`, `C17`, `A400`, `P8`, `E3CF`…), and (2) the `adsb.lol` `dbFlags` mil bit when present. Set `meta.isMilitary` in `aircraftToWorldObject`.

**Layers / stores.**
- Extend `LayerKey` in `lib/layers.ts`: `"planes"` → keep, add `"military"` and `"airports"`. Default military on, airports off. `GlobeView` filters plane WorldObjects by `meta.isMilitary` against the two toggles.
- MapLibre: reuse the existing plane symbol source. Add a `military` icon variant in `lib/icons/svg.ts` (sharp delta vs rounded civil). Trails already drive a `line` layer from `usePlanes` — give military trails a distinct `color`.
- Route line (NEW): on dossier open, add a GeoJSON source `plane-route` (great-circle `LineString` origin→aircraft→destination) + dashed `line` layer; remove on close.
- Airports (NEW): GeoJSON source `airport-delays`, `circle` layer with `circle-color` a `match` expression on severity (`ground-stop` red, `ground-delay` amber, `arrival`/`departure` yellow) and `circle-radius` interpolated by delay minutes.

**Files to ADD:** `lib/sources/adsbdb.ts` (typed fetchers + parsers), `lib/sources/faaDelays.ts`, `lib/planes/military.ts`, `app/api/aircraft/[hex]/route.ts` (enrichment, server-cached ~10 min), `app/api/delays/route.ts` (server-cached ~2 min), `lib/airports/useDelays.ts` (poll hook), `components/AirportDelayDetail.tsx`, `components/RouteLine.tsx` (imperative map source mgr).
**Files to CHANGE:** `lib/sources/adsb.ts` (set `isMilitary`), `lib/layers.ts`, `components/LayerControl.tsx` (3 toggles + live counts), `components/PlaneDetail.tsx` (lazy-load enrichment, photo, route), `components/GlobeView.tsx` (route + airport layers), `lib/world.ts` (add `"airport"` kind + `meta.isMilitary`, `meta.route`).

**SSRF/proxy.** All three upstreams are server-side only — clients hit our `/api/*`, never the vendors. The **aircraft photo URL** from adsbdb is cross-origin and untrusted, so it goes through the existing image proxy: add the adsbdb photo CDN host to `lib/proxy/allowlist.ts` and render `proxy?url=`. No raw upstream URL reaches the client. Each fetch keeps `redirect:'error'` + `AbortSignal.timeout`.

**UX.** Click a plane → right dossier slides in; route/registration/photo lazy-load with a skeleton, falling back to "route unknown" / "no photo" on miss (never error-blocks the panel). Hover shows callsign + alt tooltip. LayerControl shows live counts (`Civil 412 · Mil 7 · Airports 3`). Delays panel on airport click lists active programs. Loading = dimmed counts; empty = "no aircraft in coverage"; error = last-good retained (already the hook's behavior). Keyboard: `M` toggles military, command-palette entries for each layer.

## 5. Dependencies & prerequisites
- Requires the P0 MapLibre single-engine shell (`trafficnerd-v2-design` spec) — symbol/line/circle layers + click→dossier wiring.
- Reuses the SSRF image proxy (`lib/proxy/allowlist.ts`) and the icon sprite pipeline (`lib/icons/*`).
- No new npm deps (great-circle math is a small local helper alongside `lib/geo/haversine.ts`).

## 6. Risks & mitigations
- **adsbdb rate limits:** enrich only on click (not per-frame), server-cache by hex/callsign 10 min, debounce rapid clicks. Degrade gracefully when missing.
- **adsb.lol load:** keep the 8 s server cache + 12 s client poll; regions stay radius-bounded so dense airspace stays legible.
- **Performance (100s of planes):** keep symbols/trails in MapLibre GL (GPU), not DOM; cap trail length (existing `pushHistory`); only the open plane gets a route line.
- **FAA feed shape/CORS:** server-side parse only; tolerate schema drift with defensive parsing; airports default off.
- **ToS/attribution:** credit adsb.lol, adsbdb, and FAA in `AttributionBadge`.

## 7. Acceptance criteria
- [ ] Planes render within ~3 s of load and move on each poll.
- [ ] Military and Civil are independent toggles with distinct icons + live counts; `M` toggles military.
- [ ] Clicking a plane lazy-loads registration, type, photo (via image proxy), and origin→destination, drawing a route line that clears on close.
- [ ] Enrichment misses degrade to graceful fallbacks, never blank/erroring the dossier.
- [ ] Airports toggle shows delay markers colored by severity; clicking one lists active programs.
- [ ] No raw upstream URL (incl. photo) ever reaches the client; new hosts are allowlisted.
- [ ] `lib/planes/military.ts` and parsers are unit-tested; `npm test` green.

## 8. Out of scope / future
Historical flight playback/replay; per-flight scheduled-vs-actual delay calc; non-US delay feeds; Wingbits/OpenSky as secondary position sources; airport diagram detail pages; alerting on specific tail numbers.
