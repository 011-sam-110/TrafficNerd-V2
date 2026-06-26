# PRD: GPS jamming / interference zones
> Priority: P2 · Effort: M · Status: Proposed · Category: data-layer

## 1. Summary
A toggleable "GPS interference" overlay that paints the daily GPSJam aggregate onto the globe and the zoomed map as translucent H3 hexagons, coloured by how many aircraft in each cell reported degraded navigation. It is an analytical context layer: when a plane's track jitters or a vessel's position jumps, the operator can flip this on and immediately see "yes, this cell is a known jamming zone today."

## 2. Why it matters for TrafficNerd
TrafficNerd already plots live aircraft (adsb.lol) and is adding ships. GNSS jamming/spoofing is the single most common cause of erratic ADS-B/AIS tracks — positions freeze, teleport, or describe impossible turns. Today a user sees the glitch with no explanation. This layer turns "weird track" into "weird track *inside a red interference hex*", which is genuine transport-intelligence value and pairs naturally with the existing breadcrumb trails over conflict regions (Eastern Europe, Middle East, Black Sea).

## 3. worldmonitor.app reference
worldmonitor exposes "GPS jamming zones" as one toggle inside its cyber/strategic set, rendered as coloured affected regions sourced from gpsjam.org (ADS-B Exchange anomaly data aggregated into H3 res-4 hexes). We replicate the data semantics but render it through TrafficNerd's own globe/map stack and dossier panel, not worldmonitor's.

## 4. How we build it (TrafficNerd-specific)

**Data source (CONFIRMED, high confidence).** GPSJam publishes a dated daily file:
`https://gpsjam.org/data/YYYY-MM-DD-h3_4.csv` — verified live (HTTP 200, ~187 KB, `content-encoding: gzip`, `cache-control: max-age=3600`, dates from 2024 through 2026-06-24). Columns: `hex,count_good_aircraft,count_bad_aircraft` where `hex` is an H3 **resolution-4** index. Keyless. **No `Access-Control-Allow-Origin` header → must be fetched server-side** (matches our existing CelesTrak/adsb pattern). Classify per GPSJam's own scheme: `ratio = bad/(good+bad)`; drop cells with `good+bad < 3` (noise); `ratio < 0.02` = none (drop — clutter), `0.02–0.10` = medium (amber), `> 0.10` = high (red). Today's file may not exist until the ~00:00 UTC roll-up, so default to **yesterday UTC** and fall back to the prior day on 404. Attribution: "GPS interference data: GPSJam (J. Wiseman) · derived from ADS-B Exchange" — add to `AttributionBadge`.

**Files to ADD**
- `lib/sources/gpsjam.ts` — builds the dated URL from a hardcoded template, `fetch`es (Next auto-gunzips), parses CSV, classifies, TTL-caches (1 h) with serve-stale + prior-day fallback. Exports `getJammingCells(date?)`.
- `lib/jamming/classify.ts` — pure `ratioToLevel()` + thresholds/colours (unit-testable).
- `lib/jamming/toGeoJSON.ts` — converts kept cells → `FeatureCollection` of hex polygons via `h3-js` `cellToBoundary`; props `{ hex, level, ratio, count }`.
- `app/api/jamming/route.ts` — `GET`, optional `?date=`, returns `{ date, generatedAt, fc }`, sets `Cache-Control: public, s-maxage=3600`.
- `lib/jamming/useJamming.ts` — `useSyncExternalStore`/hook (mirrors `useSatellites`) fetching `/api/jamming` once + hourly refresh; exposes fc, cell count, date, status.
- `tests/unit/jamming.test.ts`.

**Files to CHANGE**
- `lib/layers.ts` — add `"jamming"` to `LayerKey` + initial state `jamming: false` (off by default — specialist).
- `components/LayerControl.tsx` — add a "GPS interference" row (amber dot) with live cell count + an expand key showing the medium/high swatches and the date.
- `components/GlobeView.tsx` — read `useJamming()`, gate on `layers.jamming`, feed `<Globe polygonsData>` with `polygonCapColor` by level, near-surface `polygonAltitude`, `onPolygonClick → overlay.open(...)`; wire count into the existing `counts={{…}}` prop (line ~232).
- `components/MapView.tsx` — add a `jamming` GeoJSON source + `fill` (opacity ~0.35, data-driven colour) + thin `line` layer, exactly like the existing planes/trails wiring; `setData` on change; visibility bound to `layers.jamming`.
- `lib/overlay-content.tsx` — hex dossier: date, % aircraft affected, aircraft sampled, plain-English severity.
- `package.json` — add `h3-js` (Uber, MIT, keyless).

**UX.** Default off. On → amber/red translucent hexes, no heavy borders at globe distance. Loading shows "GPS interference · loading…" in the freshness ticker (never blocks render). Click a hex → right slide-in dossier. Empty/both-days-404 → row disabled with "no data". Error with no cache → row shows "unavailable", layer hidden. Toggle is the existing keyboard-reachable `aria-pressed` switch (Tab + Enter/Space). Ticker shows the data date + "UTC daily".

**SSRF/proxy.** This is *not* the media proxy and needs no `/api/proxy` allowlist entry: the client never supplies a URL, only an optional `date`. Validate `date` against `^\d{4}-\d{2}-\d{2}$`, clamp to `2022-01-01 ≤ date ≤ today (UTC)`, and interpolate it into the single hardcoded host/path template — so there is no user-controlled host and no SSRF surface.

## 5. Dependencies & prerequisites
- `h3-js` added to dependencies.
- No new env vars, no keys.
- Relies on existing `lib/layers`, `overlay`, `AttributionBadge`, and the GeoJSON-layer patterns in `MapView`.

## 6. Risks & mitigations
- **Single community source / availability.** GPSJam is one volunteer site. Mitigate: TTL cache + serve-stale + prior-day fallback; layer degrades to "unavailable" without breaking the globe.
- **CSV schema or URL drift.** Parse defensively (header-checked); on failure serve stale and log; unit tests pin the parser.
- **Payload/perf.** Filtering to medium+high cells keeps it to a few hundred polygons; server returns ready GeoJSON so the client does no H3 math.
- **Misreading "jamming."** Data is a 24 h *aggregate of anomalies*, not real-time and not proof of intentional jamming. Dossier copy must say "aircraft reporting degraded GPS accuracy (daily aggregate)."

## 7. Acceptance criteria
- Toggling "GPS interference" renders amber/red hexes on both the globe and the zoomed map, and hides them when off.
- `/api/jamming` returns valid GeoJSON for the default (yesterday-UTC) date and an explicit `?date=`, with prior-day fallback on 404.
- Cells with `<3` aircraft or `ratio<0.02` are excluded; colours match the medium/high thresholds.
- Clicking a hex opens a dossier with date, % affected, and aircraft count.
- Attribution to GPSJam + ADS-B Exchange is visible; no key required; client never receives an upstream URL.
- Unit tests cover the classifier and CSV parser; layer absence never breaks the rest of the app.

## 8. Out of scope / future
- Date scrubber / animated history playback across days.
- Auto-correlating a flagged plane/ship track with the hex it sits in ("this track is inside a jamming zone") — strong follow-up once ships land.
- Maritime-specific spoofing feeds (e.g. AIS circle-spoofing) and any second corroborating GNSS source.
- Real-time (sub-daily) interference data.
