# Widget Redesign Audit — every fullscreen widget

_Generated 2026-07-10 from a 42-agent audit (one agent per fullscreen widget, each read the real adapter + detail component and assessed the upstream provider's fuller capability), plus a synthesis pass. Scope: 7 core widgets with bespoke detail views + 35 signal layers. The shared signal detail was overhauled the same day (KPIs, filter, When column, value chips, axes, legend, export) — recommendations here are what remains on top of that._

## The single biggest finding

**~30 signal widgets currently rank and visualise a meaningless 2–10 / 0–10 log-radius *proxy* instead of each provider's real scalar** (earthquake magnitude, AQI, fire radiative power, port TEU, wind kt, ACLED fatalities, grid MW…). The drill-down already shows the real number, so the table sort, min-value slider, Peak KPI, distribution histogram and gradient legend all contradict it. Declaring one `source.metric {field, domain, unit}` + a numeric prop per adapter lights up **all of that machinery at once** — it's the highest-leverage change in the whole audit and rides the shared detail view that was just built.

## Prioritized roadmap

| # | Change | Impact | Effort | Category | Widgets |
|---|--------|--------|--------|----------|---------|
| 1 | Declare a real numeric SignalMetric (+ numeric prop) per source, replacing the 2–10/0–10 log-radius proxy | high | medium | usefulness | Earthquakes, EMSC, Aurora, Active fire (FRP MW), GPS jamming, Nuclear (MW), Airports (elev), Major ports (TEU), GDELT conflict, Protest, ACLED (fatalities), Displacement, Food security (FCS%), Grid load (MW), Military flights (alt), Ships (SoG), Internet outages (score), Cyber C2 (count), Weather (°C), AQI, Air-quality stations (µg/m³), GDACS (alertscore/severity), Wildfires, Volcanoes, Severe storms (kts), Floods (area), Tropical cyclones (kt) |
| 2 | Set feature.ts from the provider's real event timestamp to revive the 24h chart, When column and recency sort | high | quick | ingestibility | Internet outages, Cyber C2, Ransomware, Food security, Grid load, Military flights, GDACS, ACLED, Tropical cyclones (append 'Z') |
| 3 | Parse dropped human-impact/severity fields into props.severity so the Severity legend, red dots and alert list fire | high | quick | usefulness | Earthquakes & EMSC (PAGER alert + tsunami), GDACS (severity), ACLED (civilian_targeting), Military flights (emergency squawk 7500/7600/7700), Space weather (max G,R,S), Disasters |
| 4 | Add a free-text search box + persist active search/facets into widget config | high | quick | usefulness | Cameras (name/road/region), Headlines, Markets |
| 5 | Set feature.link to the provider's authoritative human page instead of the JSON self-link | medium | quick | ingestibility | Wildfires, Floods, Volcanoes, Rocket launches, Airports, Displacement, Internet outages, Ships (MMSI), Tropical cyclones, Grid load, Nuclear, Ports |
| 6 | Make the shared Distribution panel metric-aware AND able to bin by a categorical prop with the source's own colour map | high | medium | visualization | Country instability, UK crime (by category), Humanitarian emergencies (by disaster type), Protest, GDELT conflict, News/Headlines |
| 7 | Add a generic categorical facet-chip/dropdown filter row driven by an enumerable prop | high | medium | customization | Satellites (group), Active fire (confidence/day-night/sensor), Disasters & GDACS (hazard type/status), ACLED (event_type), Ships (type/chokepoint), Military flights (operator/emitter), Ransomware (gang/sector), Cyber C2 (family/online), Nuclear/Airports (status/type), UK crime (category), Cameras (country) |
| 8 | Colour markers by a real field + render the matching swatch/banded legend, replacing flat hue and mislabelled gradients | medium | medium | visualization | Cameras (live/still/offline), Severe storms & Tropical cyclones (Saffir-Simpson), Ships (type), Ransomware (gang), Ports (TEU), Weather (temp ramp), Volcanoes (recency), Nuclear (status), Airports (continent), GPS jamming/AQI/Active fire (bands), Grid load (utilisation) |
| 9 | Parse the full provider track/series (not just the last point) into duration/peak/momentum props + a per-row sparkline | high | medium | usefulness | Wildfires, Volcanoes, Severe storms (peak-of-track wind), Floods, Space weather (Kp history), Grid load (15-min curve), Food security (fcsGraph momentum), Markets (7d sparkline seed) |
| 10 | Emit provider Polygon/LineString into SignalFeature.geometry (globe + inset) instead of a lone centroid | high | large | visualization | NHC cone (Disasters, Tropical cyclones), Severe storms/Wildfires track, Floods & GDACS & Internet outages polygons, GPS jamming H3 hexes, Aurora oval, Displacement flow lines, Food security adm1, Nuclear/Airports footprints, Submarine cables route, Grid load flows |
| 11 | Add a time-window / feed-variant selector (days, magnitude, timespan) | medium | medium | customization | Earthquakes (all_hour…all_month × mag), EMSC, Active fire (1→10d), GDELT & Protest (24h/3d/7d), Floods/Wildfires/Volcanoes (days/status), UK crime (monthly) |
| 12 | Parse feed images/thumbnails into card & drill-down slots | medium | medium | visualization | News (oEmbed titles + maxres), Headlines (media:thumbnail), GDELT conflict & Protest (shareimage), Ransomware (leak-site screenshot), Rocket launches (rocket image) |
| 13 | Surface honest coverage/precision notes: top-N-of-M caps, data date, model-vs-measured, source scope | medium | quick | professionalism | Aurora, GPS jamming, Active fire, Satellites (TLE epoch age), Rocket launches (net_precision), Tropical cyclones (basin scope), Protest ('media volume not events'), Landing stations ('400 of N'), Food security (predicted badge) |
| 14 | Set kind:'asset' with an asset template so infrastructure widgets drop empty event/24h panels | medium | quick | professionalism | Nuclear plants, Major ports |
| 15 | Enrich CSV/GeoJSON exports with parsed props + add status/freshness sort keys (and add export where missing) | medium | quick | ingestibility | Cameras, Wildfires, Cyber C2 (raw IOC), Landing stations (add export), Ships (track) |
| 16 | Real live status from keyless oEmbed replacing the always-on LIVE badge + live program titles | medium | medium | professionalism | News |
| 17 | Persist a rolling per-poll snapshot to power true cross-session sparklines, playback and 'new since last look' | medium | large | visualization | Disasters & Events, EMSC, GPS jamming (day-diff), Markets, roadmap-wide |
| 18 | Merge provider static/companion feeds for identity & richer metadata | medium | large | usefulness | Ships (ShipStaticData: type/IMO/destination/draught), Active fire (NOAA-20/21+MODIS), Satellites (SATCAT owner/type), Airports (runways.csv), Submarine cables (landing-point country) |
| 19 | User watchlist / adjustable weights for customizable views | medium | large | customization | Markets (pin arbitrary tickers), Country instability (live re-weight factors) |
| 20 | Surface road + direction and Digitraffic/Castle Rock multi-view imagery | medium | medium | usefulness | Cameras |

## Cross-cutting themes

### 1. Real SignalMetric vs the log-radius proxy
**Applies to:** ~30 widgets: Earthquakes, EMSC, Aurora, Active fire (FRP), GPS jamming, Nuclear, Airports, Major ports, GDELT conflict, Protest, ACLED, Displacement, Food security, Grid load, Military flights, Ships (AIS), Internet outages, Cyber C2, Weather, AQI, Air-quality stations, GDACS, Wildfires, Volcanoes, Severe storms, Floods, Tropical cyclones, Rocket launches, Markets (FX)

For each source, parse the provider's real scalar into a NUMERIC prop and declare source.metric {field, domain, unit}. This single per-adapter change lights up the already-built Value column, sort, min-value slider, Peak KPI, Distribution histogram and gradient legend that today rank a meaningless 2–10 / 0–10 clamp the drill-down itself contradicts. Highest leverage in the whole audit.

### 2. Dead time axis — set feature.ts from real event timestamps
**Applies to:** Internet outages, Cyber C2 (max last_online), Ransomware (attackdate), Food security (c.date), Grid load (A65 Period start), Military flights (now−seen_pos), GDACS (datemodified), ACLED (event_date), Tropical cyclones (append 'Z'), Rocket launches (future NET → T-minus)

Populate feature.ts from the provider's onset/observation timestamp so the 24h chart, When column and recency sort stop rendering '—'. For future-dated providers (launches) invert the time model to a T-minus countdown; for daily aggregates (GPS jamming) show the honest data date instead of 'updated Xm ago'.

### 3. Centroid dots where the provider ships real geometry
**Applies to:** Disasters/NHC cone, Tropical cyclones (track+cone), Severe storms & Wildfires (track LineString), Floods & GDACS & Internet outages (affected-area polygons), GPS jamming (H3 hexagons), Aurora (oval band), Displacement (origin→asylum flow lines), Food security (adm1 choropleth), Nuclear/Airports (footprint & runways), Submarine cables (route MultiLineString), Grid load (interconnector flows)

Emit the fetched Polygon/LineString into SignalFeature.geometry (the WorldMap fill/line path already exists) and render it in the inset too, instead of collapsing to a centroid point.

### 4. Categorical faceting beyond title-search
**Applies to:** Cameras (country/region/operator), Satellites (group), Active fire (confidence/day-night/sensor), Disasters & GDACS (hazard type/status), ACLED (event_type/actor), Ships (ship type/chokepoint), Military flights (operator/emitter), Ransomware (gang/sector), Cyber C2 (family/online-only), Headlines (story topic), Nuclear/Airports (status/type/service), UK crime (category), Markets (watchlist)

Add a generic enumerable-prop facet-chip/dropdown row so users can isolate one category; today most widgets offer only free-text title search.

### 5. Flat single-hue markers vs categorical/graded color + matching legend
**Applies to:** Cameras (live/still/offline), Severe storms & Tropical cyclones (Saffir-Simpson), Ships (ship type), Ransomware (gang), Ports (TEU tier), Weather (temp ramp), Volcanoes (recency), Nuclear (status), Airports (continent), GPS jamming/AQI/Active fire (banded), Grid load (utilisation), Submarine cables (colour-by)

Colour markers by a real field and render the corresponding swatch/banded legend, replacing the uniform hue and the mislabelled min→max gradient legend.

### 6. Dropped human-impact / severity signals
**Applies to:** Earthquakes & EMSC (PAGER alert + tsunami), GDACS (severitydata.severity), ACLED (civilian_targeting → critical), Military flights (emergency squawk 7500/7600/7700), Space weather (colour by max(G,R,S) not G alone), Disasters

Parse the provider's impact/severity fields into props.severity/alertLevel so the shared Severity legend, red map dots and alert list fire on the events that actually matter — not raw magnitude.

### 7. Distribution panel is empty or wrong for metric-less / categorical sources
**Applies to:** Country instability (per-factor stack), UK crime (by category), Humanitarian emergencies (by disaster type, not 3/5/7 proxy), Protest/GDELT (metric-aware bins), News/Headlines

Make the shared Distribution panel metric-aware AND able to bin by a categorical prop (with the source's own colour map) when no numeric magnitude exists.

### 8. Dead 'Source ↗' — set feature.link to authoritative pages
**Applies to:** Wildfires/Floods/Volcanoes (GDACS/GVP/InciWeb vs raw EONET JSON), Rocket launches (webcast/advisory), Airports (home/wikipedia), Displacement (UNHCR country page), Internet outages (IODA dashboard), Ships (MarineTraffic by MMSI), Tropical cyclones (NHC advisory), Grid load, Nuclear, Ports

Prefer the provider's human URL over the JSON self-link so the drill-down link resolves to a credible page and exports carry it.

### 9. Media/thumbnail imagery discarded from feeds
**Applies to:** News (oEmbed titles/maxres), Headlines (media:thumbnail), GDELT conflict & Protest (shareimage), Ransomware (leak-site screenshot), Rocket launches (rocket image)

Parse the already-delivered image URL and render it as a card/drill-down thumbnail to convert text walls into a scannable visual monitor.

### 10. Provider time-series & track fetched then thrown away
**Applies to:** EONET track (Wildfires/Volcanoes/Severe storms/Floods → duration/observations/wind curve), Space weather (full Kp history), Markets (7d sparkline seed, FX history), Grid load (15-min curve), Food security (fcsGraph), Displacement (multi-year), UK crime (monthly)

Parse the full series instead of keeping only the last point, and surface it as a per-row sparkline plus derived props (duration, peak-of-track, momentum Δ).

### 11. Permanent-infrastructure widgets forced into the event schema
**Applies to:** Nuclear plants, Major ports (and already cables/landings)

Set kind:'asset' with an asset template so the empty 'last 24h' event panel, meaningless 24h Δ/sparkline and '—' When column stop rendering for infrastructure that has no timestamps.

### 12. Honesty: truncation caps, precision and data-currency
**Applies to:** Aurora & GPS jamming & Active fire ('top N of M'), Satellites (TLE epoch age), Rocket launches (net_precision), Tropical cyclones (NHC-only basin scope), Protest ('media volume, not events'), Landing stations ('showing 400 of N'), Food security (predicted vs measured badge)

Surface the active cap/threshold, model provenance and precision inline — matching the repo's never-fabricate ethos — instead of implying full coverage or hard measurement.

### 13. Enrich CSV/GeoJSON export with carried-but-unshown metadata
**Applies to:** Cameras (road/direction/region/freshness), Wildfires (duration/observations/source), Cyber C2 (raw ip:port IOC), Landing stations, Ships (track LineString)

Once fields are parsed into props, add them to the export payload and add status/last-sampled sort keys; several widgets also lack export entirely (landing stations).

## Next upgrades to the shared signal detail (lift many widgets at once)

- Uniform source.metric consumer: make the detail view read {field, domain, unit} from the source so a one-line adapter metric declaration simultaneously lights the Value column, value-sort, min-value slider, Peak KPI, gradient legend and Distribution histogram. This is the single upgrade that unlocks the largest roadmap row across ~30 widgets.
- Metric-or-categorical Distribution panel: when no numeric magnitude is declared, fall back to binning by an enumerable prop (props.category/type/status/gang) using the source's own colour map, so CII, UK crime, Humanitarian, Protest and News stop showing an empty or proxy-driven histogram.
- Legend component that switches modes: banded/thresholded legend (named breakpoints e.g. AQI Good→Hazardous, FRP 5/20/50/100 MW, GPS-jam 10/20/30/50%) and a categorical swatch legend, instead of only a min→max gradient — and pick the mode from how features are coloured so map colours are never unexplained.
- Generic categorical facet-chip/dropdown filter row driven by any enumerable prop, plus a free-text search box over title/props, with both persisted into widget config alongside the existing view toggle.
- Time-axis honesty modes: render 24h/recency when feature.ts is present; a T-minus/upcoming-schedule mode for future-dated providers (launches); a 'data current to <date>' label for daily aggregates; and normalise timezone-less stamps (append 'Z') so When/age are correct.
- Inset-map geometry + encoding parity with the globe: render SignalFeature Polygon fills and LineStrings in the inset, size/opacity markers by metric or confidence, colour by status, number ranked candidates, and cluster at low zoom.
- Drill-down building blocks: a source-link row, an image/thumbnail slot, a per-feature sparkline fed from a props series, a props breadcrumb/link renderer, and a 'top coverage' list — so widgets can enrich detail without bespoke UI.
- Status/freshness sort keys (live/still/offline, lastSampled, updated) exposed generically, plus a 'showing N of M (cap/threshold …)' truncation-honesty note and exposed filter thresholds.
- Asset-kind template: an infrastructure variant of the detail view that omits the event/24h/Δ panels and the '—' When column for timestamp-less permanent assets (ports, nuclear, cables).
- Severity plumbing that reads props.severity/alertLevel uniformly (PAGER, GDACS, civilian-targeting, emergency squawks, max(G,R,S)) to drive the Severity legend, red map dots and the alert list consistently across event widgets.
- CSV/GeoJSON export that automatically serialises all declared props + geometry (not just id/title/lat/lon), so parsing a field once makes it exportable everywhere.

## Per-widget findings

### Wildfires
**Provider:** NASA EONET (Earth Observatory Natural Event Tracker) v3, wildfires category

**Unused provider data:**
- The whole geometry[] track — adapter keeps only geoms[last], discarding duration, observation count and the spread path
- events[].description text and closed date (active-vs-ended, days-burning)
- All sources[] beyond sources[0].id, and every source url (link currently points at the JSON self-link, not a human page)
- days / status / bbox query params — hardcoded status=open&days=30

**Top pick:** Parse the discarded geometry[] track into duration-days + observation-count and declare it as the source metric — one adapter change fills the wildfire fullscreen's empty Distribution, Value, Peak and slider that read "—" today.

**Improvements:**
- 🎯 Parse full geometry[] track into props.started / durationDays / observations _(usefulness, medium)_
- 📊 Declare a metric on WILDFIRES_SOURCE (field durationDays, domain [0,30], unit d) _(visualization, quick)_
- 📊 Emit the track as a LineString geometry so the globe shows fire spread/progression _(visualization, medium)_
- ✨ Surface all sources[] as provenance chips and point the human link at sources[0].url _(professionalism, quick)_
- 📊 Per-row detection-cadence sparkline in the drill-down from geoms[].date _(visualization, medium)_
- 🎛️ Window/status control: days=7/30/90 and include closed events (status=all) _(customization, large)_
- 📊 Overlay GIBS thermal-anomaly/true-color imagery via /api/v3/layers/wildfires _(visualization, large)_
- 📥 Add started/duration/observations/source columns to CSV + GeoJSON export _(ingestibility, quick)_

### Headlines
**Provider:** Keyless world-news RSS/Atom feeds merged server-side (BBC World, Al Jazeera, NPR, Guardian World, DW, France 24)

**Unused provider data:**
- Article images (media:thumbnail/media:content) — cards are 100% text
- Real <category> story-topic tags — facets today use OUTLET home region, not story topic
- Author byline (dc:creator)
- <guid> for stable dedupe/cluster ids (uses raw URL today)

**Top pick:** Surface media:thumbnail/media:content article images on the cluster cards — the feeds already carry them and it converts a text wall into a visual monitor for the biggest professionalism+visualization jump, keyless, no new endpoint (extend parser + NewsItem + card render).

**Improvements:**
- 📊 Show article thumbnails from media:thumbnail/media:content on cluster cards _(visualization, medium)_
- 🎯 Parse RSS <category> tags into a real story-topic facet row _(usefulness, medium)_
- 🎯 Wire the existing /api/news/summary route into a per-card 'Summarise' button _(usefulness, medium)_
- ✨ Add byline (dc:creator/author) under each card headline _(professionalism, quick)_
- 🎛️ Persist search query + active facets in widget config (like the view toggle) _(customization, quick)_
- 📥 Dedupe and key clusters on <guid> instead of raw URL _(ingestibility, quick)_
- 🎛️ Add per-outlet topic channels (business/tech/science) as selectable extra feeds _(customization, large)_
- 🎯 Geocode story place-names and add a 'locate on map' action per cluster _(usefulness, large)_

### Volcanoes
**Provider:** NASA EONET v3 (Earth Observatory Natural Event Tracker) — volcanoes category

**Unused provider data:**
- Full geometry[] track — we keep only geoms[last], discarding first-observed date, active-days duration and observation count
- sources[] beyond [0] and their urls — the Smithsonian GVP link (authoritative VEI, eruption type, summit elevation) is thrown away
- Human source label via /api/v3/sources — we surface raw id 'SIVolcano'
- closed flag + status=all — recently-ended eruptions and eruption duration (endpoint hardcodes status=open)

**Top pick:** Parse the full geometry[] observation track into firstObserved / activeDays / observations props — the single richest field EONET already returns and the adapter currently throws away.

**Improvements:**
- 🎯 Parse full geometry[] track into props: firstObserved, activeDays, observations count _(usefulness, quick)_
- 🎯 Keep every sources[] entry with its url; add Smithsonian GVP 'Source' drill-down link _(usefulness, quick)_
- 📥 Default sort to recency (not magnitude) for metric-less sources like volcanoes _(ingestibility, quick)_
- ✨ Resolve raw source ids (SIVolcano/PDC) to human labels via /api/v3/sources _(professionalism, quick)_
- 📊 Feed the dead Distribution panel an active-days or observation-count histogram from the track _(visualization, medium)_
- 📊 Colour/size inset-map dots by recency or activeDays instead of uniform #dc2626 _(visualization, medium)_
- 🎛️ Add a days/status control (30/90/365, include-ended) to show eruption duration _(customization, large)_
- 🎯 Enrich severity from Smithsonian WVAR / USGS VNS aviation colour code + alert level _(usefulness, large)_

### Earthquakes
**Provider:** USGS Earthquake Catalog — real-time GeoJSON summary feed (+ FDSN event query API + per-event detail products)

**Unused provider data:**
- alert (PAGER) human-impact tier — dropped entirely
- tsunami flag — dropped
- sig significance 0-1000 — dropped
- felt/cdi/mmi shaking-felt intensity — dropped

**Top pick:** Parse the PAGER `alert` field into an `alertLevel` prop — one line, and it immediately feeds the existing severity/alert machinery with a real human-impact tier that raw magnitude can't convey.

**Improvements:**
- 🎯 Parse PAGER `alert` into an `alertLevel` prop _(usefulness, quick)_
- 🎯 Surface the `tsunami` flag as a prop + drill-down badge _(usefulness, quick)_
- 📊 Make depth a NUMERIC prop and add a depth sort/filter/histogram axis _(visualization, medium)_
- 🎛️ Add a window+magnitude selector mapping to summary-feed variants _(customization, medium)_
- 🎯 Surface `sig` (significance 0-1000) as a prop and optional ranking metric _(usefulness, medium)_
- 🎯 Add felt/cdi/mmi shaking-intensity fields to the row drill-down _(usefulness, quick)_
- ✨ Surface magType, status and updated _(professionalism, quick)_
- 📊 Per-event detail drill-down: ShakeMap intensity Polygon geometry + PAGER loss estimate _(visualization, large)_

### Cameras
**Provider:** Multi-source road-CCTV aggregation (TfL, Caltrans, SCDOT, Fintraffic Digitraffic, Castle Rock 511, TripCheck, DriveBC, NZTA, Iceland, Estonia, Traffic Scotland) + a separate Windy Webcams layer

**Unused provider data:**
- Camera.direction is dropped at the /api/cameras route projection; never shown
- Camera.road is carried to the client (CameraRow) but never rendered in the table, wall, or dossier
- Digitraffic exposes several presets (directional views) per station; only the first is surfaced
- Castle Rock county, description, and its multiple images[] views are collapsed to one snapshot

**Top pick:** Add a free-text search box (name/road/region) — a few lines over the existing `filtered` memo, and the single biggest usability gap given thousands of cameras behind a 300-row cap with no way to find one.

**Improvements:**
- 🎯 Free-text search box filtering name / road / region above the table + wall _(usefulness, quick)_
- 🎯 Surface road + direction: add direction to the route projection, render 'road · direction' in the table column and tile caption _(usefulness, quick)_
- 📥 Enrich CSV/GeoJSON exports with road, direction, country, region, refreshSeconds, lastSampledAt and add status + last-sampled sort keys _(ingestibility, quick)_
- 🎛️ Country/region facet chips (ISO2 grouping) plus a 'cameras near me' sort using /api/near + geolocate _(customization, medium)_
- 📊 Colour InsetMap points by live/still/offline and cluster density at low zoom _(visualization, medium)_
- 🎯 Fold the Windy Webcams layer into the fullscreen as a toggled section (categories, city, viewCount, daylight image) _(usefulness, large)_
- 🎯 Per-camera view switcher in the dossier for Digitraffic presets and Castle Rock images[] (multiple directional views) _(usefulness, large)_
- 📊 Persist per-operator live/still/offline series and render a stacked-area coverage history _(visualization, medium)_

### Active fire detections
**Provider:** NASA FIRMS (MODIS/VIIRS thermal anomalies)

**Unused provider data:**
- FRP as a numeric metric (kept only as a string + compressed 2–10 proxy)
- scan × track pixel footprint (km) — real spatial extent per detection
- bright_ti5 (11µm band) — flaming vs smouldering / gas-flare discrimination
- instrument + version fields

**Top pick:** Declare FRP (MW) as the source's SignalMetric and store frp as a numeric prop — a few-line adapter change that instantly makes the already-built Value column, Distribution, min-value slider and Peak KPI report real fire radiative power instead of a compressed 2–10 proxy.

**Improvements:**
- 🎯 Declare FRP (MW) as the source metric + store frp as a numeric prop _(usefulness, quick)_
- 🎛️ Add categorical facet filters (confidence H/N/L, day/night, satellite) to the filter bar _(customization, medium)_
- 🎯 Fuse NOAA-20/21 + MODIS NRT endpoints, merged and deduped by cell _(usefulness, large)_
- 📊 Extend day range 1→up to 10 days for a true multi-day history + day-over-day Δ _(visualization, medium)_
- 🎯 Scope-bbox subsetting instead of a global top-1500-by-FRP cap _(usefulness, large)_
- 📥 Parse scan×track footprint + bright_ti5 into the drill-down and size markers by pixel area _(ingestibility, quick)_
- ✨ Label the FRP colour-ramp breakpoints (5/20/50/100 MW) in the map legend _(professionalism, quick)_

### Disasters & Events
**Provider:** Aggregate keyless feeds: USGS earthquakes + GDACS multi-hazard alerts + NOAA NHC tropical cyclones

**Unused provider data:**
- USGS PAGER `alert` (est. fatalities/economic-loss colour) and `tsunami` flag — the strongest human-impact signals, discarded
- USGS `mmi`/`cdi`/`felt` (shaking intensity + Did-You-Feel-It reports), `sig`, `status` (reviewed vs auto), `type` (quarry blast/explosion)
- GDACS `alertscore` (continuous) collapsed to fixed 3/6/8; `severitydata.severity`+unit native magnitude (e.g. wind kph, flood dead/displaced) unused
- GDACS population/affected-exposure figures and `url.geometry` polygon footprints (flood extent, storm track) — only the ADMIN centroid is plotted

**Top pick:** Surface USGS PAGER `alert` (estimated fatalities/loss colour) + `tsunami` flag on quake rows and drive the severity ramp from them — one adapter change unlocks impact-based triage the feed is currently throwing away.

**Improvements:**
- 🎯 Surface USGS PAGER `alert` + `tsunami` flag as quake row chips and feed the severity ramp _(usefulness, quick)_
- 🎯 Use GDACS `alertscore` (continuous) + `severitydata.severity`/unit instead of the fixed Green=3/Orange=6/Red=8 bucket _(usefulness, quick)_
- 🎛️ Add a feed sort toggle (severity/recent/nearest) plus quake `type`/`status` chips to drop quarry-blasts & unreviewed events _(customization, quick)_
- 🎯 Show GDACS population-exposure ('~N people affected') on rows and exposure-weight the tier _(usefulness, medium)_
- 📊 Draw the NHC forecast cone + track polyline on the InsetMap/globe _(visualization, large)_
- 📊 Plot GDACS `url.geometry` affected-area polygons and use them for the proximity/threat test _(visualization, large)_
- 📊 Persist a rolling per-poll event snapshot to power true sparklines, playback and 'new since last look' _(visualization, large)_
- 🎛️ Add EMSC seismic (adapter exists) and a USGS timeframe/significance feed selector (all_week, M4.5_day) _(customization, medium)_

### Floods
**Provider:** NASA EONET (Earth Observatory Natural Event Tracker) — floods category

**Unused provider data:**
- Polygon footprint geometry — adapter collapses each flood area to a centroid dot
- closed end-date — open-vs-ended status and event duration
- sources[].url GDACS human report link — link falls back to raw EONET JSON API instead
- source id ('GDACS') provenance chip

**Top pick:** Derive polygon area (km²) as the declared flood metric — it single-handedly lights up the Value column, distribution histogram, min-value filter, Peak KPI and gradient legend, all of which are empty today because floods carry no magnitude.

**Improvements:**
- 🎯 Compute polygon area (km²) in the adapter and declare it as the flood metric _(usefulness, medium)_
- 📊 Populate SignalFeature.geometry from the EONET Polygon so the flood extent renders as a fill on the globe _(visualization, medium)_
- 📥 Parse country from the title into a props.country column + group-by-country counts _(ingestibility, quick)_
- ✨ Prefer sources[].url over e.link so 'Source ↗' opens the GDACS report, not raw EONET JSON, and show a 'GDACS' provenance chip _(professionalism, quick)_
- 🎯 Parse closed + onset date into an Active-N-days / Ended status chip and duration column (fetch status=all) _(usefulness, medium)_
- 🎛️ Add a time-window selector (7/30/90 days) driving the days= param, per-source override _(customization, medium)_
- 📊 Underlay EONET /layers GIBS MODIS water imagery in the Locations inset map _(visualization, large)_

### Severe storms
**Provider:** NASA EONET (Earth Observatory Natural Event Tracker) v3

**Unused provider data:**
- the entire track — 33 of 34 points discarded; we keep only geometry[last]
- numeric wind (kts) — stashed as string props.intensity, no metric, so histogram/sort/peak/slider stay dead
- peak-of-track wind — we take the last point's value (often the weakened tail: Bavi's last is 35kt vs 155kt peak)
- per-point date series — the wind-vs-time intensification curve

**Top pick:** Declare a numeric wind metric and compute peak-of-track wind (kts) into props — one small adapter+registry change that revives the Value column, Peak KPI, magnitude histogram, min-value slider and value-sort, which are all dead/dashes for severe storms right now.

**Improvements:**
- 🎯 Declare a wind metric + expose peak-of-track wind (kts) as numeric props.windKts _(usefulness, quick)_
- 📊 Emit each storm's full track as a LineString geometry instead of a lone dot _(visualization, medium)_
- 📊 Colour each storm by derived Saffir-Simpson category (TS→Cat5 ramp), not flat indigo _(visualization, quick)_
- 📊 Add a wind-vs-time sparkline of the 34-point track in the row drill-down _(visualization, medium)_
- 🎯 Derive and show forward motion ('WNW at 12 kt') + current vs peak wind from last two points _(usefulness, quick)_
- ✨ Surface the closed lifecycle field + an intensifying/weakening trend chip _(professionalism, quick)_
- 🎛️ Add a source/basin filter and a recently-closed (status/days) toggle to the filter bar _(customization, medium)_
- 📥 Export each storm as a GeoJSON LineString track, not a single point _(ingestibility, quick)_

### Country instability index
**Provider:** In-app synthesis — ACLED (conflict) · WFP HungerMap (food) · UNHCR (displacement) · IODA (outages)

**Unused provider data:**
- Raw per-factor magnitudes: adapter keeps only norm % — discards actual fatalities/30d, displaced headcount, food % and IODA severity
- UNHCR split: refugees vs asylum-seekers vs IDPs (we sum them), plus returnees, stateless, year-over-year deltas, country-of-asylum destinations
- WFP: absolute food-insecure headcount (metrics.fcs.people), rCSI coping index (metrics.rcsi), subnational admin1 FCS, historical FCS trend, predicted-vs-measured flag
- IODA: per-signal breakdown (BGP / active-probing ping-slash24 / Google GTR), subnational region outages, discrete outage alert events with start/end (/v2/alerts)

**Top pick:** Render each row's per-factor breakdown as a colour-coded stacked contribution bar — the CII's signature "shows its work" data, currently invisible as flat text.

**Improvements:**
- 📊 Stacked per-factor contribution bar per country row _(visualization, medium)_
- 📥 Emit raw per-factor magnitudes into props (fatalities/30d, displaced, food %, IODA severity) _(ingestibility, quick)_
- 📊 Colour-coded 'Top driver' tag/column (conflict=red, food=amber, displacement=violet, outages=slate) _(visualization, quick)_
- ✨ Bucket the Distribution panel by the real 0–100 score, not the clamped 2–10 radius proxy _(professionalism, quick)_
- ✨ Coverage confidence pips + a 'min factors' filter _(professionalism, medium)_
- 🎛️ Client-side adjustable factor weights (re-rank live) _(customization, medium)_
- 🎯 Per-country instability Δ vs prior period (rising/falling arrow) _(usefulness, large)_
- 🎯 Split UNHCR displacement into refugees / asylum-seekers / IDPs in props _(usefulness, quick)_

### News
**Provider:** YouTube Live (keyless iframe embeds) + world-news RSS rail

**Unused provider data:**
- Real live program titles via oEmbed (tiles show hardcoded channel names)
- Stream up/down status (rotated dead ids still render a green LIVE badge)
- Closed captions + language track (cc_load_policy/cc_lang_pref/hl from i18n)
- maxresdefault higher-res thumbnails (stuck on soft 480p hqdefault)

**Top pick:** Add a keyless oEmbed meta route that yields both the live program title and up/down status per channel, then use it to replace hardcoded tile names and the always-on LIVE badge.

**Improvements:**
- 🎯 Live program titles via keyless YouTube oEmbed route _(usefulness, medium)_
- ✨ Replace unconditional LIVE badge with real status from oEmbed 200 vs 404 _(professionalism, medium)_
- 📥 Render RSS description under each rail headline _(ingestibility, quick)_
- 🎯 Enable captions/lang via cc_load_policy + hl from i18n locale + CC toggle _(usefulness, quick)_
- 📊 Use maxresdefault thumbnail with onError fallback to hqdefault _(visualization, quick)_
- ✨ Source-logo + corroboration badges on rail via existing cluster+SourceIcon _(professionalism, medium)_
- 🎛️ Star/Favorites section wired to the unused NewsProvider.favorite field _(customization, quick)_

### Tropical cyclones
**Provider:** NOAA NHC active storms

**Unused provider data:**
- forecast track line + cone-of-uncertainty polygon geometry
- publicAdvisory.url / advNum / issuance (feature.link is never set → Source ↗ hidden)
- forecastGraphics cone image
- binNumber → basin label

**Top pick:** Declare a real max-wind (kt) metric and store numeric wind/pressure so the whole metric-aware fullscreen view ranks and labels storms by true intensity instead of the 3–10 radius proxy.

**Improvements:**
- 🎯 Declare a real wind metric (field windKt, domain [34,157], unit ' kt') + store numeric pressure _(usefulness, quick)_
- 🎯 Set feature.link = publicAdvisory.url and add advNum/issuance props _(usefulness, quick)_
- 📊 Render forecast track (LineString) + cone-of-uncertainty (Polygon) via SignalFeature.geometry _(visualization, large)_
- 📊 Bin the Distribution panel by Saffir–Simpson category (TD/TS/Cat 1–5) _(visualization, medium)_
- 📊 Decode movementDir to a compass heading and draw a motion bearing arrow on the inset marker _(visualization, medium)_
- 📥 Parse binNumber into basin + add an honest coverage note _(ingestibility, quick)_
- 📥 Append 'Z' to lastUpdate before Date.parse _(ingestibility, quick)_
- 🎯 Add NHC Tropical Weather Outlook (2-/7-day formation %) as pre-storm disturbance areas _(usefulness, large)_

### Markets
**Provider:** Yahoo Finance v8 chart (primary charts/ATH) + CoinGecko (crypto), Frankfurter/ECB (FX); Finnhub/FRED key-gated

**Unused provider data:**
- Per-candle volume (Candle.v) shown only on hover, never as time-axis volume bars
- Yahoo meta.fiftyTwoWeekHigh/Low + regularMarketDayHigh/Low (true 52wk & day range regardless of selected range)
- Yahoo meta.currency (every asset incl. FX is hardcoded to $)
- Yahoo meta.currentTradingPeriod + exchangeName (market open/closed pill)

**Top pick:** Add time-axis volume bars under the candlestick chart — the Yahoo volume is already parsed into Candle.v and only shown on hover, so it's a quick, high-impact professionalism/visualization win.

**Improvements:**
- 📊 Add time-axis volume bars beneath the price candles _(visualization, quick)_
- 🎯 Surface CoinGecko 7d & 30d % change columns in the table/drill _(usefulness, quick)_
- 🎯 Give FX rows a Yahoo chartSymbol (EUR=X) so currencies get real history + daily % change _(usefulness, medium)_
- ✨ Show true 52-wk hi/lo, day range, exchange + market open/closed from Yahoo meta _(professionalism, quick)_
- 📥 Enrich the crypto drill with total_volume, market_cap_rank, circulating/max supply & FDV _(ingestibility, quick)_
- ✨ Plot dividend & split markers on equity charts via Yahoo &events=div,splits _(professionalism, medium)_
- 📊 Seed rail sparklines from real 7d data (CoinGecko sparkline_in_7d + Yahoo history) _(visualization, medium)_
- 🎛️ User watchlist: add/pin/reorder arbitrary Yahoo tickers persisted to widget config _(customization, large)_

### GDACS multi-hazard alerts
**Provider:** GDACS — Global Disaster Alert & Coordination System (UN OCHA / EC JRC)

**Unused provider data:**
- alertscore (declared in the interface but never read) and episodealertscore
- severitydata.severity numeric + severityunit — the real per-hazard magnitude
- datemodified / polygondate
- glide, iso3, affectedcountries

**Top pick:** Parse severitydata.severity+severityunit AND read the already-declared alertscore into a metric, so the Value column and distribution stop showing the fabricated 3/6/8 alert-level proxy.

**Improvements:**
- 🎯 Parse severitydata.severity + severityunit into props (real magnitude, not the 3/6/8 proxy) _(usefulness, quick)_
- 📊 Store alertscore and declare metric {field:'alertscore',domain:[0,3]} (keep 3/6/8 only for dot radius) _(visualization, quick)_
- 🎛️ Add a hazard-type facet (EQ/TC/FL/VO/DR/WF chips) + type-glyph map markers via the icon field _(customization, medium)_
- 📊 Fetch url.geometry (getgeometry) to render cyclone track/cone and flood/quake affected-area polygons _(visualization, large)_
- 📥 Surface htmldescription/description in the row drill-down _(ingestibility, quick)_
- ✨ Parse datemodified and use it for the When column / an 'updated' prop _(professionalism, quick)_
- 📥 Parse affectedcountries, glide and source into props _(ingestibility, quick)_
- ✨ GDACS-native Red/Orange/Green legend + show episodealertlevel vs overall _(professionalism, medium)_

### Locate (photo geolocation)
**Provider:** freellmapi.co vision-LLM gateway (default backend) + optional GeoCLIP geo-embedding sidecar; Photon (Komoot OSM) resolves place labels

**Unused provider data:**
- Image EXIF GPSLatitude/GPSLongitude/DateTimeOriginal/camera make — never read, so real geotags are ignored
- Photon per-candidate osm_value category (peak/city/etc.), state/county/city/district, postcode, countrycode — fetched then discarded (country faked via lastSegment string-split)
- Photon extent/bbox — parsed by normalizePhoton but dropped; could draw an uncertainty area
- GeoCLIP top_k 6-10 and its probability spread — capped at 5 discrete pins

**Top pick:** Read EXIF GPS (and DateTimeOriginal) from the uploaded file and plot a ground-truth pin plus km-distance to the model's top estimate — biggest usefulness leap and perfectly matches the widget's estimate-not-GPS-truth ethos.

**Improvements:**
- 🎯 Read EXIF GPS + DateTimeOriginal client-side and show a ground-truth pin vs the estimate _(usefulness, medium)_
- 📥 Surface Photon's real place fields per candidate (city/state/country breadcrumb, countrycode, osm category chip) _(ingestibility, medium)_
- 📊 Size/opacity inset markers by candidate.confidence and number them 1..n _(visualization, quick)_
- 📊 Draw each candidate's Photon extent/bbox as an uncertainty rectangle on the inset _(visualization, medium)_
- 🎯 Ask the vision model for a structured cues[] array (architecture/signage/language/driving-side/vegetation) and render as tags _(usefulness, medium)_
- 🎯 'Live cameras near this estimate' — call existing /api/near for the selected candidate _(usefulness, medium)_
- 🎛️ Candidate-count control (show up to GeoCLIP's top_k=10 / LLM 5) _(customization, quick)_
- 🎛️ Session history strip of past locates (thumbnail + top estimate, click to re-fly) _(customization, medium)_

### Satellites
**Provider:** CelesTrak (NORAD GP / TLE)

**Unused provider data:**
- The dozens of other GROUPs — user is stuck on 'visual'; no runtime switch to starlink/gps/geo/weather/stations/military
- TLE EPOCH / element age — never shown, so SGP4 accuracy honesty is missing
- BSTAR drag term (reentry/decay watch)
- International designator / launch year (provenance)

**Top pick:** Add a runtime group switcher — the provider exposes dozens of GROUPs but the fullscreen is hardwired to 'visual'; useSatellites already accepts the group arg, so this is the highest-value-per-line change.

**Improvements:**
- 🎛️ Add a group switcher (chips/dropdown) in the fullscreen header _(customization, quick)_
- ✨ Parse and surface TLE epoch age ('elements 6.2 h old') _(professionalism, quick)_
- 📥 Show international designator + launch year in vitals _(ingestibility, quick)_
- 🎯 Next visible pass for the viewer's location (AOS/max-elev/LOS + azimuth) _(usefulness, large)_
- ✨ Switch adapter to FORMAT=json for typed BSTAR, REV_AT_EPOCH, classification _(professionalism, medium)_
- 🎯 Join SATCAT for real object type, owner/country flag, launch & decay date, RCS size _(usefulness, large)_
- 📊 Orbit-regime badge (LEO/MEO/GEO) + coverage footprint for GEO sats _(visualization, medium)_
- 🎯 Sunlit/eclipse visibility status for the selected satellite _(usefulness, medium)_

### Aurora oval
**Provider:** NOAA SWPC OVATION aurora model

**Unused provider data:**
- Numeric probability (we keep it only as the string '88%')
- Observation Time (dropped; every cell stamped with Forecast Time instead)
- Data Format field (ignored)
- The full continuous oval band — we render 300 scattered dots, not a contour/polygon

**Top pick:** Parse probability as a number and declare a SignalMetric — a few-line adapter change that revives the Value column, sort, min-value filter and Peak KPI, which all render '—' for aurora today.

**Improvements:**
- 🎯 Parse probability as a number and declare metric {field:'probability',domain:[50,100],unit:'%'} _(usefulness, quick)_
- 📊 Feed the declared metric into the Distribution panel (or set a scaled numeric magnitude) so aurora bins into 50/60/75/90% probability bands _(visualization, medium)_
- 📊 Emit the oval as SignalGeometry (Polygon band / per-hemisphere viewline LineString) from the continuous grid _(visualization, large)_
- 🎯 Surface Kp index + G-scale storm level (and IMF Bz driver) from sibling SWPC keyless endpoints as masthead context _(usefulness, large)_
- ✨ Parse Observation Time and label cells '+30 min forecast' instead of stamping all with Forecast Time _(professionalism, quick)_
- 🎛️ Add per-cell hemisphere (N/S from lat sign) as a searchable prop _(customization, quick)_
- 📥 State 'top 300 of N cells ≥50%' and expose the MIN_PROBABILITY/MAX_POINTS thresholds _(ingestibility, quick)_

### EMSC earthquakes
**Provider:** EMSC-CSEM Euro-Med seismic catalogue (seismicportal.eu FDSN event web service)

**Unused provider data:**
- Numeric depth (we stringify to '3.0 km' so it can't sort/filter/encode)
- evtype — earthquake vs suspected explosion/quarry blast (mislabelled as quake today)
- lastupdate — revision time, distinguishes revised vs preliminary auto-solutions
- magtype semantics (mb/ml/mw shown as raw 'm')

**Top pick:** Parse depth as a numeric depthKm (not the dead '3.0 km' string) and surface it as a sortable Depth column + shallow/deep colour band — depth is the top post-magnitude seismic signal and is currently inert.

**Improvements:**
- 📊 Numeric depthKm → sortable Depth column + shallow(<70)/intermediate/deep(>300km) map colour band _(visualization, medium)_
- ✨ Parse evtype; badge/filter non-earthquake events (se=suspected explosion, quarry blasts) _(professionalism, quick)_
- ✨ Parse lastupdate; flag revised events (lastupdate >> time) with revision age _(professionalism, quick)_
- 📥 Humanise magtype beside the value (mb=body-wave, ml=local/Richter, mw=moment) _(ingestibility, quick)_
- 🎛️ Scope-aware server query (bbox/maxradius from active scope) + minmag floor _(customization, medium)_
- 🎯 Join EMSC felt-reports (testimonies-ws) by unid: community felt count + reported intensity _(usefulness, large)_
- 🎯 Historical backfill via starttime/endtime for real 7d/30d seismicity rate + playback _(usefulness, large)_
- ✨ includeallmagnitudes/includeallorigins → alternate solutions + location uncertainty (azimuthal gap, #stations, RMS) _(professionalism, large)_

### Rocket launches
**Provider:** The Space Devs — Launch Library 2 (LL2 2.2.0)

**Unused provider data:**
- probability (%) — a real 0–100 scalar we could declare as the metric
- image / infographic URLs — per-launch rocket imagery
- mission.description, mission.type, mission.orbit.name
- status.abbrev + status.description (stable enum + blurb)

**Top pick:** Re-encode the time axis for FUTURE events — a T-minus countdown and an upcoming schedule — because relativeAge clamps every future net to "0s" and the 24h panel is always empty, making today's time model wrong for this provider; pair it with the quick probability-as-metric win to revive the inert Value/Peak/slider.

**Improvements:**
- 🎯 Replace past-oriented time-ago/24h with a T-minus countdown + upcoming schedule _(usefulness, medium)_
- 📊 Declare probability as the source metric { field:'probability', domain:[0,100], unit:'%' } _(visualization, quick)_
- 📊 Parse image URL and show a rocket thumbnail in the row drill-down and map popup _(visualization, medium)_
- 📥 Parse mission.description, mission.type and mission.orbit.name into props _(ingestibility, quick)_
- ✨ Parse net_precision and label imprecise dates ("NET June 2026" / "±Day") _(professionalism, quick)_
- ✨ Drive status from status.abbrev + status.description instead of substring-matching name _(professionalism, quick)_
- 🎛️ Add a provider/program facet filter and per-provider colour encoding _(customization, medium)_
- 🎯 Surface a "Watch live" link from webcast_live / vidURLs in the drill-down _(usefulness, medium)_

### Air quality (AQI)
**Provider:** Open-Meteo Air-Quality API (CAMS/GEMS)

**Unused provider data:**
- us_aqi_* per-pollutant sub-indices -> dominant pollutant (never requested)
- carbon_monoxide + sulphur_dioxide (2 of 6 EPA criteria pollutants, missing)
- actual hourly AQI history + next-day forecast (we only chart city-count over time)
- european_aqi has no band label/colour of its own (stored as bare number)

**Top pick:** Declare a metric (field usAqi, domain [0,300]) and set props.magnitude=aqi — a few-line change that switches on the entire overhauled detail view (Value column, slider, Peak, histogram, gradient legend, sorting) which is currently blank for AQI.

**Improvements:**
- 🎯 Declare metric{field:'usAqi',domain:[0,300]} AND set props.magnitude=aqi _(usefulness, quick)_
- 🎯 Request us_aqi_* sub-indices, emit props.dominant = argmax pollutant _(usefulness, medium)_
- 📊 Distribution + legend by the 6 EPA bands (Good…Hazardous) in official band colours _(visualization, medium)_
- ✨ Add carbon_monoxide + sulphur_dioxide to request and props _(professionalism, quick)_
- 🎯 Fetch hourly=us_aqi past_days=1 forecast_days=1 for a real per-city AQI trend + forecast _(usefulness, large)_
- 🎛️ US↔European AQI standard toggle driving colour/value/band _(customization, medium)_
- 📥 Add a per-band health advisory line (cautionary statement) in the drill-down _(ingestibility, quick)_
- 🎯 Add uv_index + aerosol_optical_depth/dust props _(usefulness, quick)_

### Major ports
**Provider:** World Port Index (NGA Pub 150) — but the adapter actually ships a curated static top-~70 busiest-container-ports list, not the live WPI

**Unused provider data:**
- Annual TEU throughput (the natural magnitude) — dropped from the curated source
- World busiest rank (#1 Shanghai …) — dropped
- Every WPI attribute: harbor size, depths, shelter, facilities, cranes, supplies
- UN/LOCODE + authoritative port page (no link on any feature today)

**Top pick:** Add annual TEU throughput to each port record and declare it as the source metric — one field revives the slider, legend, distribution panel, Value column and Peak KPI that are all inert today.

**Improvements:**
- 🎯 Add per-port annual TEU throughput and declare it as the source metric _(usefulness, medium)_
- 📊 Colour each port by TEU tier instead of one flat #0891b2 _(visualization, quick)_
- 📥 Store + surface world busiest rank (#1 Shanghai) as a prop and sort key _(ingestibility, quick)_
- ✨ Humanise country ISO2 to full name + flag via existing lib/geo/flag.ts _(professionalism, quick)_
- ✨ Set kind:'asset' so the two empty event panels stop rendering placeholders _(professionalism, quick)_
- 🎛️ Swap backing data to the real NGA WPI GeoJSON with a 'major only / all' toggle _(customization, large)_
- 🎛️ Parse WPI channel/anchorage depths and offer 'max draught' as an alternate metric _(customization, large)_
- 📊 Render WPI facility flags (Container/RoRo/Fuel/Drydock/Cranes) as calm .tn-* chips in the drill-down _(visualization, medium)_

### GPS jamming
**Provider:** gpsjam.org — GPSJam (J. Wiseman), daily GNSS interference aggregated from ADS-B Exchange into H3 hexagons

**Unused provider data:**
- count_good_aircraft — we store only total + bad, so no good/bad split and no confidence weighting by sample size
- Prior-day files for the same hex → day-over-day change (new / rising / persistent / fading jamming)
- The multi-year daily archive → no date scrubber or playback across days
- The actual data DATE surfaced honestly (masthead says 'updated Xm ago', implying real-time)

**Top pick:** Emit a numeric interference % and declare a SignalMetric on GPS_JAMMING_SOURCE — a few lines that turn on the Value column, Peak KPI, min-% filter, severity sort and Distribution panel that the overhauled view already supports but which are all dark because the ratio is currently a string.

**Improvements:**
- 🎯 Emit numeric interference % and declare a SignalMetric (field interferencePct, domain [10,100], unit %) plus numeric props.magnitude _(usefulness, quick)_
- 📊 Render the real H3 hexagons in the Locations inset (fill+line) and export the Polygon geometry, not centroid dots/points _(visualization, medium)_
- 🎯 Diff yesterday vs the prior-day file per hex → NEW/RISING/PERSISTENT badge + 'Δ vs yesterday' prop _(usefulness, large)_
- ✨ Show the data date ('Aggregate for 9 Jul 2026 · UTC daily') instead of the misleading 'updated 3m ago' _(professionalism, quick)_
- ✨ Surface the good/bad split with sample size ('212 of 240 aircraft reported degraded GNSS') _(professionalism, quick)_
- 📥 Add a banded severity legend (10–20% amber, 20–30% orange, 30–50% red, 50%+ deep red) reflecting gpsjamColor _(ingestibility, quick)_
- 🎛️ Date scrubber to load any historical day via ?date= against the daily archive _(customization, large)_
- 🎛️ Caption the active server thresholds and expose min-ratio as a client control ('≥10 aircraft, ≥10% degraded, top 400') _(customization, medium)_

### Weather
**Provider:** Open-Meteo Forecast API

**Unused provider data:**
- apparent_temperature (feels-like)
- wind_direction_10m bearing + wind_gusts_10m
- precipitation/rain/snowfall + cloud_cover + pressure_msl
- is_day flag

**Top pick:** Declare a numeric temperature metric and store temp as a number prop — a few-line change that instantly revives the Peak KPI, temperature histogram, min-temp filter, map colour legend and sortable Value column that are all currently dead for this widget.

**Improvements:**
- 📊 Declare a temperature metric + store temp as a NUMBER prop (field temperatureC, domain [-20,45], unit °C) _(visualization, quick)_
- 🎯 Per-city forecast drill-down: &hourly=temperature_2m,precipitation_probability&forecast_days=2 rendered as a mini Chart in the row _(usefulness, large)_
- 🎯 Parse apparent_temperature, wind_gusts_10m, precipitation, cloud_cover, pressure_msl into props _(usefulness, quick)_
- 🎯 Flag hazardous weather via weather_code→props.severity (thunderstorm/heavy snow) + apparent_temperature heat/cold extremes _(usefulness, quick)_
- 📊 Render a wind arrow from wind_direction_10m bearing on the map dot / row _(visualization, medium)_
- 📊 Make the map legend a blue→red temperature ramp matching temperatureColor(), not source.color's single-hue blue gradient _(visualization, quick)_
- 🎛️ Unit toggle °C/°F and km/h/mph via temperature_unit/wind_speed_unit params (or client convert), wired to a widget setting _(customization, medium)_
- 🎯 Daily block: sunrise/sunset + is_day day/night glyph, uv_index_max, precipitation_probability_max _(usefulness, medium)_

### Nuclear plants
**Provider:** OpenStreetMap (Overpass API)

**Unused provider data:**
- numeric MW capacity (we keep it as an unparsed string, no metric)
- lifecycle status: operational vs under-construction vs shut-down (construction:/disused:/end_date)
- wikipedia / wikidata / website links (drill-down links only to the raw OSM node)
- the plant footprint polygon (we discard geometry and keep the centroid)

**Top pick:** Parse plant:output:electricity into a numeric capacity (MW) metric — it single-handedly activates the Value column, capacity sort, min-value slider, Peak KPI and map gradient legend that render empty today.

**Improvements:**
- 🎯 Parse plant:output:electricity into a numeric capacity metric (MW) _(usefulness, medium)_
- 🎯 Classify lifecycle status from construction:/disused:/abandoned:power + end_date into props.status _(usefulness, medium)_
- ✨ Set kind:'asset' with a nuclear asset template (status/capacity/operator/reactors) _(professionalism, medium)_
- 📊 Colour each dot by status (amber=building, grey=shutdown) or a capacity ramp _(visualization, quick)_
- 🎛️ Add Status + Operator filter dropdowns reusing the cable filter pattern _(customization, medium)_
- 📥 Surface wikipedia / wikidata / website tags as drill-down links _(ingestibility, quick)_
- 🎯 Expanded Overpass query for child power=generator reactor units _(usefulness, large)_
- 📊 Attach the plant footprint polygon via out geom as feature.geometry _(visualization, large)_

### Protest coverage
**Provider:** GDELT GEO 2.0 API — geolocated protest news coverage

**Unused provider data:**
- shareimage — parsed in GdeltFeature interface but dropped by normalizeGdelt
- All article hrefs except the first (headlines + outlet domains of the top coverage) in html
- count as a sortable magnitude — kept off props.magnitude and no source.metric declared, so it drives nothing
- GKG theme: precision codes (we use plain keyword OR-groups)

**Top pick:** Declare source.metric on articles (count) — one adapter change that revives the Value column, volume sort, min-articles filter, Peak KPI and gradient legend across the whole overhauled view.

**Improvements:**
- 🎯 Declare source.metric { field:'articles', domain:[1,40] } _(usefulness, quick)_
- 📊 Emit shareimage into props and show it as a drilldown thumbnail _(visualization, quick)_
- 📥 Parse ALL html hrefs into a 'Top coverage' list (headline + outlet domain), not just firstHref _(ingestibility, medium)_
- 📊 Set per-feature f.color as a volume gradient in the adapter _(visualization, quick)_
- 📊 Make distribution() metric-aware so it buckets the resolved metric when no props.magnitude exists _(visualization, medium)_
- ✨ Label the metric 'media volume, not verified events' + note place-level geocoding uncertainty _(professionalism, quick)_
- 🎛️ Switch queries to GKG theme:PROTEST/UNREST operators behind a theme toggle _(customization, medium)_
- 🎛️ Add a 24h/3d/1w timespan selector driving the GEO timespan param _(customization, large)_

### Internet outages
**Provider:** IODA — Internet Outage Detection & Analysis (Georgia Tech / CAIDA)

**Unused provider data:**
- Per-datasource sub-scores bgp / ping-slash24 / telescope (only scores.overall is parsed)
- Region (admin-1) and ASN/operator rows (adapter keeps only entityType==country)
- Outage event start + duration from /outages/events (feature.ts is never set)
- Raw connectivity time-series values[] from /signals (would drive a per-country drop sparkline)

**Top pick:** Declare a metric of field 'outageScore' on INTERNET_OUTAGES_SOURCE so the real IODA overall score (not the log-scaled 3–10 radius proxy) drives the Value column, Peak KPI, sort and min-value filter.

**Improvements:**
- 🎯 Declare metric→outageScore so Value/Peak/sort/filter use the real IODA score, not the 3–10 log-radius proxy _(usefulness, quick)_
- 📊 Set feature.ts from outage start (add /v2/outages/events) to fill the empty 24h timeline and When column _(visualization, medium)_
- 🎯 Parse per-datasource sub-scores (bgp, ping-slash24, telescope) into props _(usefulness, quick)_
- 📥 Set feature.link to the IODA dashboard page (/country/<code>?from&until) _(ingestibility, quick)_
- 🎛️ Add region + ASN granularity as an opt-in entityType (region/asn rows are discarded today) _(customization, large)_
- 📊 Render country/region choropleth polygons via /v2/topo instead of a lone centroid dot _(visualization, large)_
- 📊 Add a raw connectivity sparkline in the drill-down from /v2/signals values[] _(visualization, large)_
- ✨ Normalise severity words to the shared ramp's vocabulary (warning/critical) so the map legend colours by severity _(professionalism, quick)_

### Cable landing stations
**Provider:** TeleGeography Submarine Cable Map — open API v3 (keyless JSON CDN)

**Unused provider data:**
- Explicit country per station (landing/<id>.json .country, also embedded in the 'Bilbao, Spain' name) — never split out or faceted
- is_tbd planned/unconfirmed-location flag — parsed into LandingGeoFeature then dropped
- Per-cable is_planned + rfs_year at a hub → operational-vs-planned split and hub age range
- Authoritative per-hub cable list from landing/<id>.json (our list is inverted from only the cables we enriched, so it under-counts)

**Top pick:** Attach operational-vs-planned cable counts to each landing node (from cable status we already hold) and flag single-cable "chokepoint" stations — the unique value of a landing view.

**Improvements:**
- 🎯 Per-hub operational-vs-planned cable split + single-cable chokepoint flag _(usefulness, medium)_
- 🎛️ Split country out of the station name into props.country; add a country dropdown filter + column _(customization, quick)_
- 📊 Inset hub map with node radius proportional to cableCount _(visualization, medium)_
- 🎯 Neighbour-hub adjacency: 'directly connects to N stations' from landing/<id>.json .landing_points[] _(usefulness, large)_
- 📊 Show each hub's cable-year range (min/max rfs_year) + a mini RFS sparkline _(visualization, medium)_
- 📥 KPI/summary strip: total stations, busiest hub, #single-cable hubs, #countries _(ingestibility, quick)_
- ✨ Wire the dead 'Landing station' name-sort and add a 'showing 400 of N' note _(professionalism, quick)_
- 📥 Add CSV/GeoJSON export to the landing view _(ingestibility, quick)_

### ACLED conflict events
**Provider:** ACLED — Armed Conflict Location & Event Data

**Unused provider data:**
- disorder_type (top-level category)
- region + iso (continent / ISO country code)
- admin1 (parsed into interface then DROPPED from props) + admin2/admin3
- assoc_actor_1/assoc_actor_2

**Top pick:** Declare metric {field:"fatalities", domain:[0,50]} on ACLED_SOURCE so the Value column, Peak KPI, sort, min-value slider and gradient legend report REAL fatalities instead of the countMagnitude radius proxy.

**Improvements:**
- 🎯 Declare a fatalities metric on ACLED_SOURCE (field:fatalities, domain [0,50]) _(usefulness, quick)_
- 🎯 Add a rolling date window + descending event_date order to the read query _(usefulness, medium)_
- 📊 Parse event_type into a categorical breakdown bar tinted by acledColor() _(visualization, large)_
- 📥 Surface disorder_type, region, iso, admin1 (currently dropped) + admin2 into props _(ingestibility, quick)_
- 📊 Map civilian_targeting (and 'Violence against civilians') to props.severity=critical _(visualization, quick)_
- 🎛️ Category quick-filter chips (event_type / disorder_type / actor-type) _(customization, medium)_
- 📥 Decode inter1/inter2 codes into readable actor-type labels beside actor names _(ingestibility, medium)_
- ✨ Add source_scale, tags and geo/time precision to the drill-down props _(professionalism, quick)_

### Airports
**Provider:** OurAirports (davidmegginson/ourairports-data mirror)

**Unused provider data:**
- elevation_ft — the only numeric magnitude available, never parsed
- home_link + wikipedia_link — per-airport URLs that could populate f.link / 'Source ↗' + export
- icao_code + gps_code + local_code — aviation-standard codes; we surface only IATA
- scheduled_service — yes/no commercial airline service flag

**Top pick:** Parse elevation_ft and declare it as the source metric — the single field that resurrects the Peak KPI, min-value slider, gradient legend, distribution histogram, sortable Value column and map colour ramp that the overhauled template currently renders empty for this provider.

**Improvements:**
- 📊 Parse elevation_ft and declare it as the source metric (domain [0,15000], unit ' ft') _(visualization, quick)_
- 🎯 Set f.link from home_link (fallback wikipedia_link) _(usefulness, quick)_
- 🎛️ Add airport-type + scheduled_service category toggles (medium/small/heliport/seaplane; commercial-only) _(customization, medium)_
- ✨ Parse icao_code and label IATA vs ICAO in props/search _(professionalism, quick)_
- 🎯 Parse keywords into the title-search index and a prop _(usefulness, quick)_
- 📊 Colour dots by continent (categorical) with a scheduled_service filled/hollow encoding _(visualization, quick)_
- 📥 Resolve iso_country→name and add continent/iso_region props via countries.csv/regions.csv (or static map) _(ingestibility, medium)_
- 🎯 Join runways.csv: longest-runway length as a size metric, surface/count in drill-down, runway centrelines as geometry LineStrings _(usefulness, large)_

### Submarine cables
**Provider:** TeleGeography Submarine Cable Map API v3 (submarinecablemap.com, keyless JSON)

**Unused provider data:**
- Per-cable color in cable-geo.json (542 distinct hexes; grey #939597 flags the 109 planned cables) - dropped, overridden with one teal
- Full per-cable route MultiLineString geometry - fetched and on the feature but never drawn in the fullscreen
- Landing-point country + per-landing operational/planned cable split via landing-point/<id>.json (country is absent from the geo endpoint we use)
- is_tbd flag on landing points (geo + cable detail) - marks planned/undecided landing locations, parsed then discarded

**Top pick:** Parse the provider's per-cable color (dropped today) and add a "Colour by" selector so routes and status chips encode Status/Supplier/Region/RFS-decade instead of a single flat teal.

**Improvements:**
- 🎛️ "Colour by" selector (Provider colour / Status / Supplier / Region / RFS decade) driving map routes + table status chips _(customization, medium)_
- 📊 Route mini-map inset in the cable drill-down rendering the selected cable's MultiLineString geometry _(visualization, medium)_
- 📊 "Cables by ready-for-service year" build-out + planned-pipeline bar chart _(visualization, medium)_
- 📥 Promote Supplier, Region and Landing-points to sortable/filterable table columns _(ingestibility, quick)_
- 🎯 Cross-link landing names in a cable drill-down to the landing node (and cable names in the landing view to the cable) _(usefulness, medium)_
- 🎯 Owner/operator concentration mini-panel: top owners + hyperscaler-vs-consortium share _(usefulness, quick)_
- ✨ Aging-infrastructure badge: bucket rfs_year by decade and flag operational cables over ~15 yrs _(professionalism, quick)_
- 🎯 Enrich landing hubs with country + operational/planned split via landing-point/<id>.json _(usefulness, large)_

### Conflict coverage
**Provider:** GDELT GEO 2.0 — geolocated conflict news

**Unused provider data:**
- geores resolution dropped — can't strip country-level noise (e.g. 'Ukraine' on every article)
- shareimage thumbnail dropped in normalizeGdelt
- 4 of the up-to-5 articles in the html popup discarded (only firstHref kept)
- count never wired as a metric/severity encoding — value axis stays blank

**Top pick:** Declare props.articles as the source's SignalMetric — a few lines that light up the Value column, sorting, min-value filter and Peak KPI, all currently inert for GDELT.

**Improvements:**
- 📊 Declare props.articles as the source SignalMetric (domain ~[0,50], unit ' articles') _(visualization, quick)_
- 🎛️ Parse geores into props + a 'city / ADM1 / country' resolution filter _(customization, medium)_
- 🎯 Extract all up-to-5 articles from the html blob into a per-place 'Top coverage' list in the drill-down _(usefulness, medium)_
- ✨ Swap raw keyword OR-groups for GKG theme: codes (ARMEDCONFLICT, KILL, PROTEST, REFUGEES) _(professionalism, quick)_
- 📥 Surface shareimage as a thumbnail chip in the drill-down row _(ingestibility, medium)_
- 🎯 Fetch DOC TimelineVolRaw for the query and feed the masthead/24h panel real volume history _(usefulness, large)_
- 🎛️ Timespan selector (24h / 3d / 7d) threading GEO's up-to-7-day window _(customization, medium)_
- 📊 Coverage-tone severity encoding via DOC TimelineTone / tone-filtered query _(visualization, large)_

### Space weather
**Provider:** NOAA SWPC (Kp / storm scales)

**Unused provider data:**
- The entire Kp history — every row but the last is discarded
- a_running (running Ap index) and station_count (magnetometer data-quality)
- NOAA's own scale Text labels (Minor/Moderate) — we recompute our own instead
- R MinorProb/MajorProb and S Prob — radio-blackout / solar-radiation storm probabilities

**Top pick:** Add a colour-coded 'Kp — last 3 days' bar panel built from the full Kp series we already fetch and currently throw away — it converts a broken single-pin fullscreen into the recognisable NOAA geomagnetic-activity chart at near-zero data cost.

**Improvements:**
- 📊 Add a colour-coded 'Kp — last 3 days' bar panel from the series we already fetch _(visualization, medium)_
- ✨ Declare metric {field:'kp', domain:[0,9]} and drop the 2–10 magnitude clamp _(professionalism, quick)_
- 🎯 Surface the 3-day forecast (blocks 1/2/3): predicted G plus R MinorProb/MajorProb and S Prob _(usefulness, medium)_
- 📥 Give the feature ts=latest time_tag, a SWPC link, and use NOAA's own scale Text _(ingestibility, quick)_
- 🎛️ Let users set a Kp≥N browser-notification alert (reuse the new alerts subsystem) _(customization, medium)_
- ✨ Colour severity by max(G,R,S), not G alone _(professionalism, quick)_
- 🎯 Add a_running (Ap), station_count, R/S probabilities to the drill-down props _(usefulness, quick)_
- 🎯 Ingest products/alerts.json as timestamped, linkable watch/warning rows _(usefulness, large)_

### Air-quality stations
**Provider:** OpenAQ ground stations (PM2.5)

**Unused provider data:**
- Raw NUMERIC PM2.5 (stored only as a string + a 2-10 radius proxy, so no real metric)
- Station name, locality and country (shown only as '#<id>')
- isMonitor: reference-grade vs low-cost sensor quality flag
- owner/provider network (AirNow, PurpleAir, EEA, ...)

**Top pick:** Emit raw numeric PM2.5 and declare a real source.metric in µg/m³ so the entire shared toolbar (Value/sort/slider/Peak/distribution) reflects actual concentration instead of the 2-10 radius proxy.

**Improvements:**
- 📥 Emit raw numeric PM2.5 + declare source.metric {field, domain:[0,500], unit:' µg/m³'} _(ingestibility, quick)_
- 🎯 Enrich each feature with station name + locality + country from /v3/locations (title + props) _(usefulness, medium)_
- ✨ Surface isMonitor as a prop + a marker encoding (filled reference-grade vs hollow low-cost) _(professionalism, medium)_
- 📊 Row drill-down sparkline of the station's last 24-48h via /v3/sensors/{id}/hours _(visualization, large)_
- 🎯 Show co-located pollutants (PM10/O3/NO2/SO2/CO) as chips in the drill-down via /v3/locations/{id}/latest _(usefulness, large)_
- 📥 Compute numeric US-EPA AQI (0-500) alongside the band and use it as the metric domain _(ingestibility, quick)_
- 🎛️ Add owner/provider prop + a parameter switcher (PM2.5 -> PM10/O3/NO2) from /v3/parameters _(customization, large)_
- ✨ Use datetime.local and flag stale readings (>3h old) with a badge _(professionalism, quick)_

### UK crime
**Provider:** data.police.uk street-level crime

**Unused provider data:**
- persistent_id (stable crime id -> outcomes-for-crime timeline)
- outcome_status.date (when the outcome was reached)
- location.street.id (snapped location -> crimes-at-location drill-down)
- location_type (Home Office force vs British Transport Police)

**Top pick:** Render a per-category breakdown bar in the Distribution panel using the 14 category colours already defined in crime.ts, and add the matching category legend under the inset map.

**Improvements:**
- 📊 Render a per-category breakdown bar in the Distribution panel using the 14 existing category colours _(visualization, medium)_
- 📊 Add a category swatch legend under the Locations inset map _(visualization, quick)_
- 🎛️ Category facet dropdown to isolate one crime type (e.g. Violence, Burglary) _(customization, medium)_
- 🎯 Pull last N months via &date=YYYY-MM and plot a crimes-per-month trend _(usefulness, large)_
- 🎯 Parse persistent_id and drill down via outcomes-for-crime for the case outcome timeline _(usefulness, large)_
- ✨ Surface a 'data current to YYYY-MM' label from crime-last-updated instead of a per-row month prop _(professionalism, quick)_
- 📥 Parse outcome_status.date and add an outcome-status mini-breakdown _(ingestibility, medium)_
- 🎯 Query the active scope with poly= instead of 6 hardcoded city circles _(usefulness, large)_

### Cyber C2 servers
**Provider:** abuse.ch Feodo Tracker

**Unused provider data:**
- ip_address + port — the actual blockable IOC, dropped by country aggregation
- as_number/as_name — hosting ASN, parsed-then-discarded; no top-hosters view
- hostname — reverse-DNS, never even declared in FeodoRow
- first_seen — server age / campaign longevity, never parsed

**Top pick:** Thread each country's raw IP:port/malware/ASN/last_online rows into a per-row drill-down and a raw-IOC CSV — makes the C2 feed actionable instead of a count heatmap.

**Improvements:**
- 🎯 Attach each country's raw server list (ip:port, malware, as_name, last_online) to props + a raw-IOC CSV export _(usefulness, medium)_
- 📥 Declare metric {field:"c2Servers", domain:[1,30]} on CYBER_C2_SOURCE _(ingestibility, quick)_
- 📊 Malware-family breakdown panel from per-IP `malware` (Emotet vs QakBot vs IcedID) _(visualization, medium)_
- 🎯 Top hosting-ASN breakdown from as_name/as_number _(usefulness, medium)_
- 📊 Encode ONLINE count (color/size + KPI) instead of total, with 'N online / M total' _(visualization, quick)_
- 📥 Set feature.ts = max(last_online) per country _(ingestibility, quick)_
- 🎛️ Add malware-family and online-only filter chips beyond the title search _(customization, medium)_
- 🎯 Add first_seen as an 'oldest since' props field per country _(usefulness, quick)_

### Grid load
**Provider:** ENTSO-E Transparency Platform — electricity Total Load (documentType A65, processType A16 realised)

**Unused provider data:**
- Day-ahead load forecast (A65 processType A01) -> actual-vs-forecast demand margin as a stress signal
- Day-ahead spot price A44 (EUR/MWh) per zone
- Generation mix A75 -> renewable %, fuel breakdown, carbon-intensity proxy
- Cross-border physical flows A11 -> interconnector line geometry between zones

**Top pick:** Declare a metric (field: raw MW load, domain [0, 90000], unit MW) and emit that raw number as a numeric prop — one change makes the Value column, Peak KPI, min-value filter, sort, distribution histogram and gradient legend all reflect actual load instead of the log-scaled 2–10 radius proxy they show today.

**Improvements:**
- 🎯 Declare a real metric (raw MW/GW load) and store it as a numeric prop _(usefulness, quick)_
- 📥 Set feature.ts from the A65 Period timeInterval start + resolution + point position _(ingestibility, quick)_
- 📊 Colour each zone marker by grid utilisation (load ÷ zone typical peak) instead of flat amber _(visualization, medium)_
- 🎯 Fetch day-ahead load forecast (processType A01) alongside realised and surface the actual-vs-forecast margin _(usefulness, medium)_
- 📊 Keep the full 15-min load curve (parse all Points, not just the last) and draw a per-zone sparkline in the row drill-down _(visualization, medium)_
- 🎯 Add day-ahead spot price A44 (EUR/MWh) as a per-zone prop with an optional metric toggle _(usefulness, medium)_
- 🎛️ Add generation mix A75 (fuel breakdown) -> renewable % prop and colour zones by carbon-intensity _(customization, large)_
- 📊 Render cross-border physical flows (A11) as LineString geometry between adjacent zones _(visualization, large)_

### Ransomware activity
**Provider:** Ransomware.live victims

**Unused provider data:**
- victim name (collapsed into a country tally)
- per-victim attackdate/discovered timestamps (no ts set -> dead time axis)
- description (the actual leak-site post / claim text)
- domain (victim website)

**Top pick:** Restructure the adapter to emit one feature per victim (jittered on the country centroid) with ts=attackdate and link=url — this single change revives the fullscreen's dead time axis (24h chart, When, recency), adds Source links, and exposes named victims.

**Improvements:**
- 🎯 Emit one feature per victim (jittered around the country centroid) carrying victim name, ts=attackdate, link=url _(usefulness, medium)_
- 🎯 Parse description (leak-site post text) + domain (victim website) into props _(usefulness, medium)_
- 📊 Colour markers by GANG via a categorical palette + gang legend, replacing the purple victim-count ramp _(visualization, medium)_
- 📊 Add a provider-specific Top gangs + Top sectors ranked-bar panel _(visualization, medium)_
- 📊 Parse screenshot URL and render a leak-site thumbnail in the row drill-down _(visualization, medium)_
- 🎛️ Add gang and sector filter chips (filter by group / activity) _(customization, medium)_
- 📥 Parse data_size, ransom and infostealer (employees/users compromised) into props _(ingestibility, quick)_
- 🎯 Join /v2/groups for gang metadata (description, leak-site mirror + online status, profile links) _(usefulness, large)_

### Displacement
**Provider:** UNHCR Refugee Data Finder — Population Statistics API v1

**Unused provider data:**
- Country of origin — who people are fleeing (coo dropped; we request coa_all only)
- returned_refugees, returned_idps, ooc, oip, hst — all parsed-past and discarded
- stateless is shown but excluded from the total (Bangladesh's ~1M Rohingya invisible in headline)
- Real people-count as a metric — Value column shows only the 0–10 log radius proxy, not the count

**Top pick:** Declare a metric bound to the real total-displaced number (currently no metric, so every value shown is the compressed 0–10 radius proxy).

**Improvements:**
- 🎯 Declare a metric on the real displaced count (add a numeric `total` prop; metric domain [0,3M]) _(usefulness, medium)_
- 📥 Parse the discarded fields: ooc, oip, hst, returned_refugees, returned_idps + fold stateless into an honest breakdown _(ingestibility, quick)_
- 🎯 Set per-feature `link` to the UNHCR Refugee Data Finder country page _(usefulness, quick)_
- 🎯 Fetch coo_all origin breakdown → top-5 origin countries per asylum row in the drill-down _(usefulness, large)_
- 🎯 Year-over-year Δ per country (fetch two years) → real 'vs last year' per row/colour _(usefulness, medium)_
- 📊 Multi-year fetch (yearFrom 2015) → per-country history sparkline in the drill-down _(visualization, large)_
- 📊 Composition mini stacked-bar per row (refugees / asylum-seekers / IDPs / stateless split) _(visualization, medium)_
- 📊 Origin→asylum flow lines via SignalGeometry LineString (framework already renders line layers) _(visualization, large)_

### Ships (AIS chokepoints)
**Provider:** AISStream.io (real-time AIS WebSocket)

**Unused provider data:**
- Numeric Sog (stored only as string '13.5 kt', so no sort/histogram/peak)
- ShipType category (cargo/tanker/passenger/fishing/tug) — not even subscribed to
- IMO number, CallSign — stable vessel identity beyond MMSI
- Destination port + ETA (voyage intent)

**Top pick:** Store Sog as a numeric prop and declare a SignalMetric {field:'sog', domain:[0,25], unit:'kt'} — instantly lights up the Value column, speed sort, min-value slider, Peak KPI and the speed histogram in the Distribution panel that sit empty today.

**Improvements:**
- 🎯 Numeric speed metric (props.sog + SignalMetric kt 0–25) _(usefulness, quick)_
- 🎯 Subscribe to ShipStaticData, merge by MMSI → type/IMO/CallSign/Destination/ETA/length/draught props _(usefulness, large)_
- 📊 Colour dots + map legend by ship type (cargo/tanker/passenger/fishing/tug/other) _(visualization, medium)_
- 🎛️ Tag each vessel with its chokepoint box → props.chokepoint, drive a per-strait breakdown + filter _(customization, medium)_
- 📊 Rotate inset markers to TrueHeading/Cog (heading arrows via InsetPoint rotation) _(visualization, medium)_
- 🎯 Set f.link to a MarineTraffic/VesselFinder page by MMSI _(usefulness, quick)_
- 📥 Derive flag state from MMSI MID prefix → props.flag _(ingestibility, quick)_
- ✨ Add 'ais' to the KEYED set so the dormant 'needs an API key' footnote renders _(professionalism, quick)_

### Humanitarian emergencies
**Provider:** UN OCHA ReliefWeb

**Unused provider data:**
- date.event onset date → emergency duration / protracted-crisis age
- full country[] — all affected countries (regional/complex emergencies collapse to one point today)
- description narrative overview (no situation summary shown anywhere)
- type[] disaster types as real categories (only consumed as a single dot color + a joined names string)

**Top pick:** Replace the fake 3/5/7 magnitude histogram + its mismatched value legend with an honest 'by disaster type' breakdown (bars and a swatch legend colored by disasterColor), since types are the real categorical signal already fetched but discarded.

**Improvements:**
- 📊 Replace the 3/5/7 status-proxy magnitude histogram with an honest 'by disaster type' categorical breakdown, bars colored via disasterColor() _(visualization, medium)_
- 📊 Fix the map legend mismatch: show a per-disaster-type swatch legend (Flood, Cyclone, Drought, Epidemic, Conflict…) matching the type-colored dots, not the red 3→7 value gradient _(visualization, medium)_
- 🎛️ Surface status as an Alert/Current badge in the table + a status facet filter, and swap the meaningless min-magnitude slider (filters 3/5/7) for it; show 'Alerts: N' KPI instead of 'Peak 7 magnitude' _(customization, medium)_
- 🎯 Parse date.event (onset) and show emergency duration/age ('running 8 months') as a column and in the drill-down _(usefulness, quick)_
- 🎯 Parse full country[] and list all affected countries in the drill-down (optionally plot secondary-country dots) _(usefulness, medium)_
- 📥 Parse fields.description into the drill-down as a short sanitized situation-overview summary _(ingestibility, medium)_
- 📊 Deterministically jitter emergencies that share one country centroid so co-located dots render as distinct points on the globe and inset map _(visualization, quick)_
- 🎯 On drill-down, fetch /v2/reports filtered by disaster.id to show the latest situation report title/date, appeal, and map/infographic PDF link from its source org _(usefulness, large)_

### Food security
**Provider:** WFP HungerMap LIVE

**Unused provider data:**
- No real SignalMetric declared — Value/Peak/min-filter/legend rank the log-radius proxy, not FCS share
- feature.ts never set (date is only stashed in props) — When column, recency sort and freshness age are dead
- rcsi.people (absolute crisis-coping headcount) discarded; only its prevalence kept
- population denominator dropped — can't show 'X of Ypop' honestly

**Top pick:** Declare a real SignalMetric on FCS prevalence (numeric field, domain [0,0.5], unit %) and store the numeric value in props — one adapter change that makes the entire overhauled fullscreen (Value column, Peak KPI, min-value filter, gradient legend, sorting) rank real hunger share instead of the log-radius proxy.

**Improvements:**
- 🎯 Declare a SignalMetric on FCS prevalence and store it as a numeric prop (field, domain [0,0.5], unit %) _(usefulness, quick)_
- 📥 Set feature.ts = c.date _(ingestibility, quick)_
- 🎯 Parse rcsi.people and population into props (e.g. '3.2M of 41M using crisis coping') _(usefulness, quick)_
- 🎯 Parse fcsMinus1/fcsMinus3 into a signed momentum chip (Δ vs 1mo / 3mo, ▲▼ coloured) _(usefulness, medium)_
- ✨ Encode dataType as a predicted-vs-measured badge and carry the fcsHigh/fcsLow band as '±' in the drill-down _(professionalism, medium)_
- 📊 Render the per-country fcsGraph as a mini trend line in the row drill-down _(visualization, large)_
- 🎯 Add an IPC/CH phase overlay from /v2/ipc.json (phase 3+/4+/5 population, phase class as categorical severity) _(usefulness, large)_
- 📊 Fetch /v2/adm0/{code}/adm1data.json and render adm1 polygons as a subnational choropleth _(visualization, large)_

### Military flights
**Provider:** adsb.lol (military-tagged ADS-B, readsb / ADSBExchange-v2 schema)

**Unused provider data:**
- emergency field + special squawks 7500/7600/7700 (the natural severity, ignored today)
- baro_rate/geom_rate vertical rate (climb vs descent, tanker orbit vs landing)
- altitude or ground speed as a declared metric
- category emitter class (helicopter / UAV / heavy split)

**Top pick:** Parse the emergency field and decode special squawks (7500/7600/7700) into props.status/alertlevel so the shared severity Distribution, red map dots and alert list light up.

**Improvements:**
- 🎯 Parse emergency + decode squawk 7500/7600/7700 into props.status/alertlevel _(usefulness, quick)_
- 📥 Set feature.ts from now minus seen_pos*1000 (per-aircraft freshness) _(ingestibility, quick)_
- 📊 Declare source.metric = altitude (field alt, domain [0,45000], unit ft) _(visualization, quick)_
- 🎯 Parse baro_rate/geom_rate as vertical rate with a climb/descent arrow _(usefulness, quick)_
- 🎛️ Parse ownOp operator + category emitter as drill-down props and filter facets _(customization, medium)_
- 🎯 Resolve callsign via route API and draw origin-to-destination great-circle geometry _(usefulness, large)_
- 📊 Orient each inset-map dot by track into an aircraft glyph _(visualization, medium)_
- ✨ Show altitude as flight levels (FL350), add ownOp/hex country flag and a decoded-squawk line _(professionalism, quick)_
