# Focus Window — per-widget expand-to-center-stage detail views — Design Spec

> Date: 2026-07-08 · Status: Approved (design) · Owner: Sampo
> Part of the World Monitor (TrafficNerd-V2) build. Grounded in a read-only 8-agent
> code scan (2026-07-08) that traced every console widget to its real data source and
> proposed a bespoke detail view. This spec turns the main globe window into a **focus
> surface**: any widget can be expanded onto the center stage to show much deeper,
> genuinely useful information — while keeping the app's keyless-first, dormant-safe,
> "computed-not-fabricated" identity.

## 0. Where this sits

World Monitor's center "stage" already has a small switching system: `StageHost`
renders `map3d` (globe) / `map2d` (flat) / `clock`, toggled by `StageSwitch` via
`shellLayoutStore.stage()`. This feature adds a **fourth kind of stage — a focused
widget** — plus a per-widget bespoke *detail component* that fills it. The docked
console widgets are unchanged; expanding one simply changes what the center stage shows.

Every console widget participates: the 7 bespoke widgets (headlines, satellites,
markets, aviation, events, cameras/news-video) **plus** the ~30 signal layers, which
share one `signals` widget component and therefore get **one schema-agnostic detail
template** parameterised by the `SignalSource` descriptor.

## 1. Goals & success criteria

**Goal:** every widget can expand onto the main window and present its data at real
depth — the deep view a professional would actually use — without fabricating data or
adding non-keyless dependencies for the default experience.

**Success criteria:**
1. A user can click an **expand** control on any docked widget and it takes over the
   center stage; a **back** control (and the stage switch) returns to the map.
2. The focus state persists across reload (round-trips through the saved layout) and can
   be shared via URL.
3. Each detail view reuses the widget's **existing data hook** — no duplicate polling.
4. Each detail view is **dormant-safe**: on upstream failure or missing key it shows an
   honest empty / "what unlocks this" state, never a crash or fabricated value.
5. The Build gate stays green: `npx tsc --noEmit && npm test`, with pure logic
   unit-tested before UI, and a Playwright screenshot per UI milestone.

## 2. Decisions locked (2026-07-08)

| # | Decision | Choice |
|---|----------|--------|
| D1 | How focus takes the main window | **Replace the center stage** — reuse the `StageHost`/`StageSwitch`/`shellLayoutStore.stage()` seam; the globe unmounts while focused (lighter than an overlay). |
| D2 | Widget scope this pass | **All widgets bespoke** — every widget gets a custom detail view; the ~30 signal layers share **one** parameterised template. |
| D3 | Headlines AI summary | **Full-article fetch, on-demand** — server-side fetch of the article URL → readability extraction → freellmapi.co gateway. Dormant until `FREELLMAPI_*`; graceful fallback to the RSS `<description>` snippet on paywall/403. |
| D4 | Satellites deep view | **Option C** — orbital detail (ground track, full elements, next-pass-over-you) as the spine **plus** a keyless NASA GIBS earth-observation imagery tile for regional context; embed real live feeds (ISS, GOES/Himawari) only where they genuinely exist. |
| D5 | Charting primitive | **Native SVG, zero-dep** — hand-roll a `<Chart>` extending `Sparkline` (line/area/candlestick + crosshair + axes). Matches the repo's deliberate no-new-dep ethos. |
| D6 | Inset map primitive | **One shared lightweight `<InsetMap>`** — a small single-layer MapLibre instance (the dep already exists), pooled/capped, rendering points/lines/polygons/tracks. |

## 3. Architecture — the focus foundation (build once, all widgets use it)

Four pieces, all extending existing seams:

1. **Focus store** — `lib/console/focus.ts`. Holds `focusedWidgetId: string | null`.
   Implemented with the external-store + `useSyncExternalStore` pattern already used by
   `lib/overlay.ts` (the agents' recommended template). Actions: `open(id)`,
   `close()`, `useFocus()`.
2. **Stage integration** — extend `StageId` in `lib/console/types.ts` with a `focus`
   kind; add a `focus` branch to `components/console/StageHost.tsx` that renders
   `<WidgetDetail widgetId=…/>` instead of `<WorldMap/>`; `components/console/StageSwitch.tsx`
   gains a **FOCUS** chip (shown only while focused) and a **← back** control that
   restores the previous stage. The focused id round-trips through
   `lib/console/sanitize.ts` and the persisted layout serialization.
3. **Expand affordance** — one button on the `components/console/WidgetFrame.tsx`
   header (next to the `⋯` menu — the same seam the export menu was added to). Every
   widget inherits it. Clicking calls `focusStore.open(instance.id)`.
4. **Detail contract** — `WidgetType` (`lib/console/registry.ts`) gains an optional
   `detail?: ComponentType<WidgetDetailProps>` where
   `WidgetDetailProps = { instanceId: string; config: Record<string, unknown> }`.
   `<WidgetDetail>` looks up the focused instance's type and renders its `detail`
   component; a widget without one falls back to a **generic detail** (a larger scroll
   of the widget body + its export). This guarantees no expand button is ever dead.

Detail components **reuse the widget's existing data hook** (`useJsonPoll`,
`useEventFeeds`, `useSatellites`, `usePlanes`, `useSignalFeed`, …) — no duplicate fetch.

## 4. Shared primitives (build once, reused across detail views)

- **`components/Chart.tsx`** — native SVG, generalising `components/Sparkline.tsx`.
  Modes: line, area, candlestick. Features: hover crosshair + tooltip, min/max markers,
  baseline overlay, axes, up/down green(`#16a34a`)/red(`#dc2626`) tint convention. Pure
  scale/scan maths extracted to a testable helper. **No new dependency.**
- **`lib/widgets/buckets.ts`** — pure histogram/time-bin helpers (magnitude buckets,
  hourly/daily time bins). Unit-tested. Feeds the events/signals distribution charts and
  the headline volume strip.
- **`components/InsetMap.tsx`** — one shared, single-purpose MapLibre instance rendering
  exactly one layer's features (points sized/tinted, line geometry, H3 polygons,
  satellite ground-tracks with antimeridian split). Auto-fit bounds; hover/click a
  feature ↔ table row. Instances are pooled/capped so we never spawn many globes. Reuses
  `lib/map/features.ts` (`toTrailFC`) + `lib/basemaps.ts` raster patterns.

## 5. Data flow

```
[expand button on WidgetFrame]
      → focusStore.open(instance.id)
      → StageSwitch shows FOCUS chip; StageHost renders <WidgetDetail widgetId>
      → WidgetDetail resolves WidgetType.detail, renders it
      → detail view calls the SAME data hook the docked widget uses (no new fetch)
      → renders deep panels (Chart / InsetMap / tables / dossiers)
[back / stage switch] → focusStore.close() → StageHost restores previous stage (globe)
```

## 6. Error handling & honesty

- Data hooks already degrade to empty on failure; every panel has an **honest empty
  state** ("no active cyclones this season", "no public live feed for this object —
  showing orbital data + region imagery instead").
- **Key-gated** pieces (AI summary, FRED macro, ACLED / FIRMS / AISStream) render the
  *"what unlocks this"* explainer (mirroring `components/shell/DailyBrief.tsx`), never a
  fabricated value.
- The **AI summary** is SSRF-guarded (fetch restricted to the existing proxy allowlist);
  on paywall/403/empty it falls back to summarising — or just showing — the captured RSS
  `<description>`.
- **Never claim** more than the data supports: GDACS/cyclone "magnitude" is shown as the
  native alert-level / wind / pressure, not a fake unified number; satellite imagery is
  captioned as imagery *of* the ground region, not *from* that satellite.

## 7. Per-widget detail views (grounded in the scan)

Each is one gated milestone. Panels degrade gracefully when a field is absent.

### 7.1 Events — triage board *(no new data)*
Data: `projectEventFeed` rows joined back to raw `useEventFeeds().bySource` props
(USGS quakes, GDACS multi-hazard, NOAA NHC cyclones — all keyless).
Panels: (1) triage header (S0–S4 tier ribbon + type counts, click-to-filter); (2)
grouped feed with **per-domain metrics** from raw props — quake `M + depth`; cyclone
`category · maxWind · pressure · movement`; disaster `alertLevel · severity · country ·
from→to · ongoing`; (3) event geo-point map (`InsetMap`, fed by the `exportGeo`
FeatureCollection already built in `events.tsx`); (4) severity/type distribution rail
(`buckets` + `Chart`); (5) sources & attribution footer + inline CSV/GeoJSON export.
Reuse: `lib/widgets/eventFeed.ts`, `lib/events/*`, existing `exportRows`/`exportGeo`,
`SignalDetail` humanise pattern. **New work: none** beyond F1/F2.

### 7.2 Headlines — newsroom board *(+ AI summary)*
Data: `/api/news` (keyless RSS: BBC/Al Jazeera/NPR/Guardian). The RSS parser currently
**drops** `<description>` (and `media:thumbnail`/`category`) — capturing it is part of
the win.
Panels: (1) control bar (source chips w/ counts, sort, client search); (2) grouped
headline list (recency buckets or by-source) with snippet + optional thumbnail; (3)
**"also covered by"** cross-source cluster (surfaces what `mergeNews` currently
discards); (4) **on-demand AI article summary** per headline; (5) hourly volume strip
(`buckets`); (6) sources footer + CSV export.
New work: extend `parseRss` to capture `description`/`image`/`category` (keep `NewsItem`
back-compatible for `NewsTicker`); new **`/api/news/summary`** route — SSRF-allowlisted
fetch of the article URL → readability strip → freellmapi gateway (copy the
`app/api/brief` + `lib/geolocate/config.ts` `freellmConfig()` + `lib/geolocate/llm.ts`
patterns) → 3–5 sentence factual summary; cache by URL; dormant-safe. Pure prompt
builder + `parseSummaryResponse` unit-tested.
Key: `FREELLMAPI_*` (dormant → falls back to snippet).

### 7.3 Signals — one schema-agnostic template *(covers ~30 layers)*
Data: the shared `/api/signals/<id>` → `SignalFeature[]`, parameterised by the
`SignalSource` descriptor (`lib/signals/registry.ts`). Reuses `useSignalFeed` +
`projectSignal`.
Panels: (1) masthead + **count-history sparkline** (wire `lib/widgets/history.ts` /
`lib/series.ts` — history exists but no signal records into it yet) + delta + freshness +
"shown of total"; (2) source-only **`InsetMap`** (points/lines/H3 polygons/centroids);
(3) **magnitude/severity distribution** (`buckets` + `Chart`; falls back to declared
severity or an auto-detected numeric; hidden when neither exists — honest); (4) **time
distribution** (hourly/daily; "undated" note for cables/weather/aggregated sources); (5)
full sortable/groupable feature table with per-row **props drill-down** (reuse
`SignalDetail` humanise + definition-list); (6) source/attribution/methodology (+ dormant
key note for ACLED/FIRMS/AISStream/OpenAQ/ReliefWeb/ENTSOE); (7) CSV/GeoJSON export +
"show this layer on the main map".
New work: the template component; `buckets` helpers; wire count-history recording.

### 7.4 Aviation — airspace console
Data: `usePlanes()` → `{ objects, trails }` (keyless adsb.lol, 3 fixed regions);
per-flight enrichment via `/api/flight` (adsbdb).
Panels: (1) ops summary bar (airborne/ground split, per-category counts, max alt/speed);
(2) region + altitude-band filter rail; (3) master flight table (callsign, type+ICAO,
alt km/ft, speed km/h/kn, heading+compass, vertical rate, registration, region;
sortable, uncapped, CSV/GeoJSON); (4) per-flight dossier (reuse `components/PlaneDetail.tsx`
+ `/api/flight` route/airframe, click-triggered only); (5) altitude sparkline from
`trails`; (6) region **`InsetMap`** with heading-oriented markers + trails.
New work: extend `parseAdsb()` to capture `squawk` (activates the already-written
emergency 7500/7600/7700 alerts + a squawk column) — the field is already in the payload.
Note: coverage is bounded to the 3 hardcoded regions; adsbdb is per-selected-flight only
(rate limits) — both stated honestly.

### 7.5 Cameras — honest live/still wall
Data: `/api/cameras` (list) + `/api/camera/[id]` (full record + neighbours) + `/api/hls`
(SSRF-safe HLS proxy) + `/api/proxy` (still proxy). 11 operators; only **Caltrans (CA)
and SCDOT (SC)** yield playable HLS — everything else is refreshing stills.
Panels: (1) coverage-honesty bar (live/still/offline counts, per-operator chips labelled
live-HLS vs still; London/TfL explicitly stills-only pending M9's JamCam 403 fix); (2)
live HLS wall (Caltrans + SCDOT), **concurrency-capped** (~4–6 players, activate on
click/viewport, tear down off-screen — respects the ~6-connections-per-origin limit); (3)
refreshing-still walls by operator/region with per-feed countdowns; (4) focus rail (reuse
`components/CameraDetail.tsx` + nearest-cameras jump); (5) filter/export (reuse
`cameraFilterStore`).
New work: enrich `/api/cameras` payload (add `region`/`road`/`refreshSeconds`/
`attribution`/`license`/`lastSampledAt` — avoids an N+1 of `/api/camera/[id]`); a
client-side HLS concurrency manager.

### 7.6 News (video) — live news video wall
Data: `NEWS_PROVIDERS` (static catalog; all 12 currently `kind:'youtube'`) + YouTube
embeds/thumbnails (keyless) + the shared `/api/hls` proxy + `/api/news` for a paired
headline rail.
Panels: (1) hero player — **HLS-first** via `/api/hls` (reuse `CameraVideo` pattern) with
**YouTube fallback**; (2) channel wall grouped by category with keyless YouTube-thumbnail
tiles; (3) optional 2×2 mosaic multi-view (muted, one audio-focus); (4) live headline
rail (`/api/news`); (5) directory/add-custom-stream + now-playing status.
New work: add optional `hlsUrl` to `NewsProvider` and populate broadcaster `.m3u8`
(Al Jazeera/DW/France 24 publish public HLS); **route news HLS through `/api/hls`**
(currently loads raw `.m3u8` directly → CORS-blocked); extend `lib/proxy/hls-allowlist.ts`
for the chosen hosts. Avoid the YouTube Data API (would need a key) — keep the manual ref
list + custom-add.

### 7.7 Markets — trading terminal *(first heavy `<Chart>` user)*
Data: `/api/markets` (keyless crypto/commodities/FX/equities; macro dormant). Deep view
adds **real historical series**.
Panels: (1) instrument rail grouped by asset class (mini `Sparkline` preview, biggest
movers first); (2) **primary historical chart** — `<Chart>` line/area/candlestick with
1M/6M/1Y range tabs, crosshair tooltip (date + OHLC + volume), period change + 52-week
high/low; (3) instrument stats/context (market cap, currency, as-of); (4) section movers
heat-strip (reuse alert thresholds); (5) macro panel — **VIX (`^VIX`) and 10-Year
(`^TNX`) graph keyless via Yahoo**; Fed Funds/Unemployment stay key-gated (FRED) with the
dormant note; (6) footer (attribution, "indicative only, not financial advice", CSV +
per-instrument OHLC export).
New work: **`/api/markets/chart`** route proxying the keyless **Yahoo v8 chart** endpoint
with `range=1mo/6mo/1y` (full `timestamp[]` + `indicators.quote[0].{o,h,l,c,v}[]` +
`adjclose[]`); extend the `YahooChart` type + a pure `parseYahooSeries()` (unit-tested,
mirroring `markets-quote.test.ts`); a symbol-mapping table (CoinGecko id / FX pair / Yahoo
ticker → chart symbol); FX history via keyless **Frankfurter timeseries**; crypto history
via Yahoo `BTC-USD…` or CoinGecko `market_chart`. Add `^VIX`/`^TNX` to the keyless set.
Risks: Yahoo v8 is unofficial (429/crumb flakiness) — stay server-side proxied + cache
per symbol+range.

### 7.8 Satellites — orbital cockpit *(the deepest)*
Data: `/api/satellites` (CelesTrak TLE, keyless) → client SGP4 via `useSatellites` /
`propagate.ts`; classification via `classify.ts`.
Panels: (1) command bar (group selector + category chips w/ counts + element-set epoch
age as an honesty signal); (2) searchable/sortable satellite roster (left spine,
successor to today's 200-row table); (3) selected-satellite orbital vitals (NORAD, intl
designator, inclination/ecc/RAAN/argP/mean-anomaly/mean-motion, derived apogee/perigee);
(4) **live ground track** on the shared `InsetMap` (±1 orbital period, antimeridian split,
sub-point + observer markers, GeoJSON export); (5) **NEXT PASS over your location**
(OVERHEAD pill / AOS→LOS, max elevation, rise/set azimuth, a small polar sky-chart;
graceful "enable location" fallback); (6) **region imagery** — keyless **NASA GIBS**
(MODIS/VIIRS true-color) + the existing Esri close-up, captioned honestly; (7) **real
live feed only where one exists** — ISS (25544) NASA live embed; GOES/Himawari full-disk
stills for GEO weather sats; explicit "no public feed" for everything else.
New work: pure `lib/satellites/passes.ts` (`nextPass`/`isOverhead` via satellite.js
`ecfToLookAngles`/`geodeticToEcf`/`eciToEcf` — already installed, no new dep);
`lib/satellites/render.ts` (ground-track GeoJSON + antimeridian split); extend the TLE
parser for full elements; `lib/sources/gibs.ts` (keyless GIBS snapshot/tiles; allowlist
`*.earthdata.nasa.gov`); ISS/GOES/Himawari embed URLs (+ CSP `frame-src` for the ISS
YouTube embed); accept multiple groups + dedupe by NORAD in `/api/satellites`.

## 8. Testing

Pure logic unit-tested before UI (repo convention, vitest): `<Chart>` scale maths;
`buckets` histogram/time-bin; TLE element parser; `nextPass()`; ground-track antimeridian
split; `parseYahooSeries()`; the summary prompt builder + `parseSummaryResponse`; the RSS
`<description>` capture (extend the existing `parseRss` fixture test). Each UI milestone
gets a Playwright screenshot into `persona-shots/`. Gate every milestone with
`npx tsc --noEmit && npm test`.

## 9. Phased milestones (map into `ROADMAP.md`)

Foundation first, then per-widget by leverage. Each is one solo-committed, gated checkpoint.

- **F1 — Focus framework** (store + StageId + StageHost/StageSwitch + WidgetFrame expand
  + `WidgetType.detail` + persisted round-trip + generic fallback detail).
- **F2 — Shared primitives** (`<Chart>` + `buckets` + `<InsetMap>`).
- **W1 — Events detail** (no new data — proves the primitives).
- **W2 — Headlines detail** (+ `<description>` capture + `/api/news/summary`).
- **W3 — Signals detail template** (covers ~30 layers).
- **W4 — Aviation detail** (+ squawk parse).
- **W5 — Cameras detail** (+ enriched `/api/cameras` + HLS concurrency cap).
- **W6 — News-video detail** (+ `hlsUrl` + proxy routing + allowlist).
- **W7 — Markets detail** (+ `/api/markets/chart`).
- **W8 — Satellites detail** (+ passes/TLE/ground-track/GIBS).

## 10. New endpoints & keyless data sources introduced

| Item | Keyless | For |
|---|---|---|
| `/api/news/summary` (article fetch → readability → freellmapi) | key-gated (dormant, snippet fallback) | Headlines |
| RSS `<description>`/`image`/`category` capture in `parseRss` | ✅ | Headlines |
| `/api/markets/chart` (Yahoo v8 full OHLC arrays) | ✅ | Markets |
| Frankfurter timeseries / CoinGecko market_chart (FX/crypto history) | ✅ | Markets |
| `^VIX` / `^TNX` added to keyless Yahoo set | ✅ | Markets macro |
| `lib/sources/gibs.ts` (NASA GIBS true-color imagery) | ✅ | Satellites |
| `lib/satellites/passes.ts` + TLE element parser + `render.ts` | ✅ | Satellites |
| Multi-group + NORAD-dedupe in `/api/satellites` | ✅ | Satellites |
| `squawk` capture in `parseAdsb()` | ✅ | Aviation |
| Enriched `/api/cameras` payload | ✅ | Cameras |
| `hlsUrl` on `NewsProvider` + `/api/hls` routing + allowlist hosts | ✅ | News video |

## 11. Risks

- **Foundation is a prerequisite for everything** — F1 touches shared console
  types/store/StageHost/StageSwitch + persisted layout; must not regress the 3 existing
  stages (guard with tests).
- **Yahoo v8 chart** is unofficial (429/crumb 401/403, host flakiness) — server-side
  proxy + aggressive per-symbol+range cache.
- **HLS concurrency** — all HLS shares the `/api/hls` origin; cap simultaneous players.
- **AI summary** — paywalls/anti-bot 403s are common; snippet fallback is mandatory;
  SSRF allowlist is mandatory.
- **Honesty** — cyclone/GDACS "magnitude", satellite imagery provenance, camera live-vs-
  still, and "sparklines accumulate over polls" must all be labelled truthfully.
- **InsetMap** — pool/cap instances; do not reuse the 1379-line globe `WorldMap`.

## 12. Needs from Sampo

- **API keys** (all optional — keyless fallbacks exist; keys only upgrade quality):
  `FREELLMAPI_*` (unlocks the Headlines AI summary — otherwise snippet-only),
  `FRED_API_KEY` (Fed Funds/Unemployment history — VIX/10-Yr are keyless without it),
  plus the already-dormant `FINNHUB_API_KEY` / `ACLED_*` / `FIRMS` / `AISSTREAM_API_KEY`.
- No decisions outstanding — D1–D6 are locked above.

## 13. Non-goals / future

- Alerting/notifications, saved digests, and scenario/forecast engines are out of scope
  (separate PRDs exist).
- Bulk per-row flight enrichment (adsbdb rate limits) — per-selected-flight only.
- YouTube Data API (viewer counts / auto-recovering rotated live IDs) — needs a key;
  keep manual ref list + custom-add.
- Global ADS-B coverage (bounded to the 3 configured regions).
