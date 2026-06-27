# Outdoor / Exploration Map Sources — Evidence-Bound Research

> **Purpose:** source catalogue for adding OS-Maps-like outdoor/exploration features to **TrafficNerd v2** (Next.js 15 + MapLibre GL, global scope). Covers detailed topographic basemaps, route planning with distance + elevation profile, GPS locate-me, aerial/satellite toggle, 3D terrain, save/record/share routes, and POI/place search.
>
> **Method:** each section was researched with web search + page fetches **and live read-only `curl` probes of the actual endpoints** wherever possible. Every significant claim is tagged:
> - **VERIFIED** — directly confirmed by fetching the page or hitting the endpoint this session.
> - **LIKELY** — multiple secondary/official sources agree, not directly hit (e.g. needs a key).
> - **UNVERIFIED** — single weak source or inference.
>
> **Date:** 2026-06-26. Free tiers, limits and ToS change — re-verify the ones marked LIKELY before shipping.
>
> **TL;DR keyless stack for a global deployed app:** OpenTopoMap (topo basemap, cache hard) → AWS Terrain Tiles terrarium (3D terrain + hillshade, fully keyless + CORS) → client-side DEM sampling / Open-Meteo (elevation) → Photon (autocomplete geocoding) → OpenRouteService **behind a server-side proxy** (routing with ascent/descent). **For the genuine UK OS look:** OS Maps API **Outdoor** style in `_3857` capped at zoom 16 (free OpenData); the iconic Explorer/Leisure 1:25k map is **Premium, BNG-only, and not MapLibre-compatible**.

---

## 1. Ordnance Survey (OS Data Hub / OS Maps API)

The OS Data Hub exposes two relevant basemap APIs: the **OS Maps API** (raster PNG, ZXY + WMTS) and the **OS Vector Tile API** (vector `.pbf` + Mapbox/MapLibre style JSON). A newer **OS NGD API – Tiles** also exists but is out of scope.

### 1.1 Free map styles

Four styles exist — **Road, Outdoor, Light, Leisure**. Free-vs-premium is decided **per zoom level and per projection**, not per style.

| Style | Projections (layer name) | Free (OS OpenData) zooms | Premium zooms |
|---|---|---|---|
| **Road** | `Road_27700`, `Road_3857` | 3857: z7–16 · 27700: z0–9 | 3857: z17–20 · 27700: z10–13 |
| **Outdoor** | `Outdoor_27700`, `Outdoor_3857` | 3857: z7–16 · 27700: z0–9 | 3857: z17–20 · 27700: z10–13 |
| **Light** | `Light_27700`, `Light_3857` | 3857: z7–16 · 27700: z0–9 | 3857: z17–20 · 27700: z10–13 |
| **Leisure** | `Leisure_27700` **only** | 27700: **z0–5 only** | 27700: **z6–9** (max zoom 9) |

- **VERIFIED** — Four styles; Road/Outdoor/Light in both EPSG:27700 and EPSG:3857; Leisure in EPSG:27700 only. Source: <https://docs.os.uk/os-apis/accessing-os-apis/os-maps-api/layers-and-styles.md>
- **VERIFIED** — 3857 split for Road/Outdoor/Light: z7–16 OpenData, z17–20 Premium. 27700 split: z0–9 OpenData, z10–13 Premium. Source: same docs.

**Practical takeaway:** the safe £0 combo is **Road / Outdoor / Light in `_3857`, capped at zoom 16** (or `_27700` capped at z9). These render natively in MapLibre. **Outdoor** is the free style closest to a topographic/leisure look.

### 1.2 The Leisure / Explorer 1:25k style — PREMIUM

**The iconic orange Explorer (1:25k) / pink Landranger (1:50k) map is PREMIUM.**

- **VERIFIED** — `Leisure_27700` is OpenData only at z0–5 (overview scales). **z6–9 (max) is Premium.** Max zoom **9**, ~1:6,614, 1.75 m/px. Source: <https://docs.os.uk/os-apis/accessing-os-apis/os-maps-api/layers-and-styles.md>
- **VERIFIED** — Leisure is built from premium raster products: 1:25k Colour Raster (Explorer), 1:50k Colour Raster (Landranger), 1:250k, MiniScale. Source: <https://www.ordnancesurvey.co.uk/blog/using-os-leisure-maps-in-your-app>
- **VERIFIED** — Leisure has **no EPSG:3857 variant**, so it cannot be dropped into a standard Web-Mercator MapLibre map.

### 1.3 API key signup

- **VERIFIED** — Sign up at the **OS Data Hub** <https://osdatahub.os.uk/>: verify email, create an API **project**, add the API(s); the project screen shows the **Project API Key** + endpoint. Source: <https://osdatahub.os.uk/support>
- **VERIFIED** — **OS OpenData Plan: no card.** **Premium Plan: requires org name, job title, phone, and a credit/debit card.** To reach the premium zoom levels of the Maps/Vector APIs you need the Premium Plan. Source: <https://osdatahub.os.uk/support>, <https://osdeveloper.medium.com/the-os-data-hub-explained-when-detail-matters-2d4e86585b41>

### 1.4 Free monthly allowance & "transaction"

- **VERIFIED (multiple official sources)** — Premium Plan gets the **first £1,000 of premium data free every month**, **use-it-or-lose-it**, **excluding OS Places API**. OS Maps / Vector / Features APIs draw against this. OS OpenData is **free and unlimited**. Source: <https://osdatahub.os.uk/plans>, the Medium explainer above.
- **VERIFIED** — Hard rate throttle per API per project: **Live = 600 transactions/min; Development = 50/min**; exceeding → **HTTP 429**. Source: <https://docs.os.uk/os-apis/core-concepts/rate-limiting-policy.md>
- **UNVERIFIED** — Exact per-tile definition of "transaction" is not published in the docs; treat **1 tile ≈ 1 transaction** for budgeting and confirm unit pricing on the logged-in plans page.

### 1.5 Tile format, access, projections

| Aspect | OS Maps API (raster) | OS Vector Tile API |
|---|---|---|
| Format | **Raster PNG** | **Vector `.pbf` (MVT)** |
| Access | **ZXY** (REST) + **WMTS** (OGC) | ZXY-style `.pbf` + Mapbox/MapLibre **style JSON** |
| Projections | EPSG:27700 (BNG) + EPSG:3857 | 27700 + 3857 via `srs` param (default `27700`) |

- **VERIFIED** — Maps API: PNG via WMTS + RESTful ZXY, in 27700 and 3857. Source: <https://docs.os.uk/os-apis/accessing-os-apis/os-maps-api/technical-specification/zxy.md>
- **VERIFIED** — Vector API: `.pbf`, projection via `srs` enum `27700|3857` (default `27700`). Source: <https://docs.os.uk/os-apis/accessing-os-apis/os-vector-tile-api/technical-specification/tile-request.md>

### 1.6 Coverage

- **VERIFIED** — **GB-only.** 27700 is GB-only by definition; the 3857 variants are GB data served in a global projection (not worldwide coverage). Source: layers-and-styles.md above.

### 1.7 Exact URL patterns (key placement)

**OS Maps API — ZXY raster** (base `https://api.os.uk/maps/raster/v1`):
```
https://api.os.uk/maps/raster/v1/zxy/{layer}/{z}/{x}/{y}.png?key=YOUR_KEY
```
- `{layer}` enum (case-sensitive): `Road_27700`, `Road_3857`, `Outdoor_27700`, `Outdoor_3857`, `Light_27700`, `Light_3857`, `Leisure_27700`.
- Key goes in the **`key` query param** (`securityScheme: apiKey, name: key, in: query`).
- Official example: `https://api.os.uk/maps/raster/v1/zxy/Outdoor_27700/7/323/489.png?key=INSERT_API_KEY`
- **VERIFIED (spec)** <https://docs.os.uk/os-apis/accessing-os-apis/os-maps-api/technical-specification/zxy.md>
- **VERIFIED (live probe)** — `curl …/zxy/Road_3857/10/511/340.png` → **HTTP 401** `FailedToResolveAPIKey: request.queryparam.key`; with `?key=TESTKEY` → **401 `InvalidApiKey`** (path/style accepted, proceeded to key check). Confirms base path + `key` param.

**OS Vector Tile API** (base `https://api.os.uk/maps/vector/v1`):
```
Style JSON:  https://api.os.uk/maps/vector/v1/vts/resources/styles?srs=3857&key=YOUR_KEY
Tiles:       https://api.os.uk/maps/vector/v1/vts/tile/{z}/{y}/{x}.pbf?srs=3857&key=YOUR_KEY
```
- **Vector tile axis order is `{z}/{y}/{x}` (Y before X)** — different from the raster ZXY (`{z}/{x}/{y}`).
- The style endpoint returns a **standard Mapbox GL Style v8 object** — exactly what MapLibre consumes.
- **VERIFIED (spec)** <https://docs.os.uk/os-apis/accessing-os-apis/os-vector-tile-api/technical-specification/stylesheet.md>
- **VERIFIED (live probe)** — tile + styles endpoints both return **401 `FailedToResolveAPIKey`**, confirming base path + key param.

### 1.8 MapLibre vector compatibility

- **VERIFIED** — OS Vector Tile API is documented as compatible with Mapbox GL JS / MapLibre (style JSON is Mapbox-spec); official examples exist. Sources: <https://docs.os.uk/os-apis/accessing-os-apis/os-vector-tile-api.md>, <https://labs.os.uk/public/os-data-hub-examples/os-vector-tile-api/>
- **LIKELY** — **MapLibre only renders the `srs=3857` variant.** OS's MapLibre integration is built around 3857; EPSG:27700 / BNG is **not** natively supported by MapLibre and effectively requires **OpenLayers** (custom projection + OS tile matrix). For a standard MapLibre app, use `srs=3857` and append `&key=` to the tile URLs.

### 1.9 Attribution & licensing

- **VERIFIED** — OS OpenData is under the **Open Government Licence**; required string: **`Contains OS data © Crown copyright and database right [year]`**. Source: <https://www.ordnancesurvey.co.uk/customers/public-sector/public-sector-licensing/copyright-acknowledgments>
- **VERIFIED** — You must also display the **OS API logo** on the map (full-colour or white variant, defined exclusion zone/min size, inside the map window). Source: <https://docs.os.uk/os-apis/core-concepts/os-api-branding.md>
- **VERIFIED** — Premium data is **not OGL** — governed by the OS Data Hub API T&Cs. Source: <https://osdatahub.os.uk/legal/apiTermsConditions>

### Key gotchas — OS

1. **Explorer/Leisure is PREMIUM, BNG-only, low max-zoom (9), and not MapLibre-compatible** (no 3857 form). For a free build use **Outdoor** instead.
2. **MapLibre = Web Mercator only.** Always request `*_3857` / `srs=3857`. BNG tiles need OpenLayers.
3. **Stay ≤ zoom 16 in `_3857`** to guarantee £0 (z17–20 are Premium).
4. **Two tile axis orders:** raster `{z}/{x}/{y}.png`, vector `{z}/{y}/{x}.pbf`.
5. **Key is a `?key=` query param, exposed client-side** — use OS referrer/domain restrictions or proxy through your Next.js backend (reuse the existing image/HLS proxy pattern).
6. **Two limits:** £1,000/mo premium credit (use-it-or-lose-it, excludes Places) **and** a hard 600/min (live) / 50/min (dev) throttle returning 429 — build backoff into the adapter.

---

## 2. Global Keyless / Free Topographic & Outdoor Basemaps

Genuinely keyless, no-signup options: **OpenTopoMap, CyclOSM, OSM Humanitarian (HOT), Waymarked Trails** — all raster, all on capacity-limited community infrastructure with fair-use limits. Everything production-grade and high-volume (Thunderforest, MapTiler, Stadia, Tracestrack) needs a key. **The standard `tile.openstreetmap.org` server must NOT be used as an app basemap.**

| Source | Tile URL pattern | Key? | Free limit / policy | Vec/Raster | MapLibre | Attribution | Verification |
|---|---|---|---|---|---|---|---|
| **OpenTopoMap** | `https://{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png` | **No** | Fair-use only; OK "as long as our server is not heavily strained by mass downloads"; no uptime SLA | Raster | raster source/layer | `Kartendaten: © OpenStreetMap-Mitwirkende, SRTM \| Kartendarstellung: © OpenTopoMap (CC-BY-SA)` | **VERIFIED** curl z10 → 200 image/png 48.8 KB |
| **CyclOSM** | `https://{a,b,c}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png` (also `cyclosm-lite`) | **No** | OSM-France fair-use; community-hosted | Raster | raster source/layer | © OpenStreetMap contributors; CyclOSM style | **VERIFIED** curl z10 → 200 image/png 51.7 KB |
| **OSM Humanitarian (HOT)** | `https://{a,b,c}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png` | **No** | OSM-France community; capacity-limited/unreliable | Raster | raster source/layer | `© OpenStreetMap contributors. Tiles courtesy of Humanitarian OpenStreetMap Team` | **VERIFIED degraded** — curl z10 → **502** on both subdomains at probe time |
| **Waymarked Trails** (hiking/cycling/MTB overlay) | `https://tile.waymarkedtrails.org/{id}/{z}/{x}/{y}.png` (`id` = `hiking`/`cycling`/`mtb`/`riding`/`slopes`) | **No** | Community fair-use; designed as a **trail overlay**, not a standalone base | Raster | raster source/layer | © OpenStreetMap contributors; Waymarked Trails | **VERIFIED** curl z10 → 200 image/png 11.4 KB |
| **Standard OSM** | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | No | **PROHIBITED for app/heavy/bulk/offline use** | Raster | raster source/layer | `© OpenStreetMap contributors` | **VERIFIED policy** — dev/trivial only |
| **Thunderforest** (Outdoors/Landscape/Cycle/Atlas) | `https://tile.thunderforest.com/{style}/{z}/{x}/{y}.png?apikey=KEY` (`outdoors`/`landscape`/`cycle`) | **Yes** | Free "Hobby": **150,000 tile requests/month**, no card | Raster (+ vector API) | raster source/layer | © Thunderforest / Gravitystorm, © OpenStreetMap contributors | Pricing VERIFIED; URL pattern LIKELY |
| **MapTiler Outdoor / Topo** | `https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY` (vector); raster XYZ too | **Yes** | Free: **100,000 map loads/month**, no card; stops (no overage) when exceeded | **Vector** | **Native** (load style.json) | © MapTiler © OpenStreetMap (+ OpenMapTiles) | LIKELY (docs) |
| **Stadia Maps — Outdoors** | vector `https://tiles.stadiamaps.com/styles/outdoors.json`; raster `…/tiles/outdoors/{z}/{x}/{y}{r}.png` | **Effectively yes** (domain-auth or key) | "Keyless" only from authorized domains/localhost; free tier | **Both** | **Native** / raster | `© Stadia Maps © OpenMapTiles © OpenStreetMap` | URLs VERIFIED; **VERIFIED gotcha**: raw server-side curl no key → **401** |
| **Stadia/Stamen Terrain** | `https://tiles.stadiamaps.com/styles/stamen_terrain.json` (+ raster) | Same as Stadia | Same free tier | Both | Native/raster | `© Stadia © Stamen © OpenMapTiles © OpenStreetMap` | LIKELY |
| **Tracestrack Topo** | `https://tile.tracestrack.com/_/{z}/{x}/{y}.png?key=KEY` | **Yes** | Free: 100k credits, 120 req/min, **non-commercial, raster-only** (vector=6 credits) | Raster | raster source/layer | © OpenStreetMap contributors; Tracestrack | LIKELY |

### Vector vs Raster in MapLibre
- **Vector (native):** `new maplibregl.Map({ style: '…style.json' })` → MapTiler Outdoor, Stadia Outdoors (vector), Stamen Terrain (vector).
- **Raster:** add a `raster` source with the XYZ `tiles` array + a `raster` layer → OpenTopoMap, CyclOSM, HOT, Waymarked Trails, Thunderforest (classic), Stadia raster, Tracestrack.

### Gotchas — basemaps
1. **`tile.openstreetmap.org` is NOT for your app — VERIFIED.** The OSMF tile policy prohibits **bulk/pre-emptive fetching, offline use, cache-bypassing headers, and default User-Agents**; requires a unique app UA, visible `© OpenStreetMap contributors`, ≥7-day caching, HTTPS+Referer. Source: <https://operations.osmfoundation.org/policies/tiles/>
2. **OpenTopoMap fair-use is strict — VERIFIED.** Keyless + CC-BY-SA, but a single volunteer server with no uptime guarantee. Cache aggressively or self-host; don't point high traffic at it. Source: <https://opentopomap.org/about>
3. **Community tiles are fragile — proven live:** HOT returned **HTTP 502 on both subdomains** during probing. Fine for hobby/low volume, risky as a production dependency.
4. **"Keyless" Stadia is domain-authenticated, not open — VERIFIED.** Raw server-side curl → **401**. Keyless works only from registered origins (Referer/Origin). Server-side/SSR fetches need a key.
5. **Free tiers measure different units:** Thunderforest = tile requests (150k/mo); MapTiler = map loads (100k/mo, stops not bills); Tracestrack = credits (vector 6× raster, non-commercial).
6. **Waymarked Trails is an overlay** of marked trails on transparent tiles — use as a 2nd MapLibre raster layer, not the base.

**Recommendation:** zero-signup demo → OpenTopoMap base + Waymarked Trails overlay (cache hard). Production with a free tier → **MapTiler Outdoor** (cleanest MapLibre-native vector) or **Stadia Outdoors**.

Sources: <https://opentopomap.org/about>, <https://www.cyclosm.org/>, <https://operations.osmfoundation.org/policies/tiles/>, <https://www.thunderforest.com/pricing/>, <https://docs.stadiamaps.com/map-styles/outdoors/>, <https://www.maptiler.com/cloud/pricing/>.

---

## 3. Keyless Terrain DEM (3D terrain + hillshade)

The only fully **keyless, CORS-enabled, production-grade** DEM is the **AWS "Terrain Tiles" Open Data** dataset (former Mapzen/Tilezen terrarium tiles). Live to zoom 15, serves `Access-Control-Allow-Origin: *`, decoded natively by MapLibre with `encoding: "terrarium"`. Nextzen and MapTiler both **require a key**.

| Source | Endpoint | Key? | Encoding (decode) | Max z | MapLibre `encoding` | tileSize | License | Verification |
|---|---|---|---|---|---|---|---|---|
| **AWS Terrain Tiles (terrarium)** | `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png` | **No** | `(R*256 + G + B/256) - 32768` | **15** | `"terrarium"` | **256** | Open, attribution required | **VERIFIED** 200 image/png z10/12/14/15, CORS `*` |
| AWS (normal) | `…/normal/{z}/{x}/{y}.png` | No | surface normals + α (not a plain DEM) | 15 | n/a | 256 | same | VERIFIED 200 image/png |
| AWS (geotiff) | `…/geotiff/{z}/{x}/{y}.tif` | No | raw float DEM (GIS, not raster-dem) | ~14 | n/a | 512 | same | VERIFIED 200 image/tiff |
| **MapTiler Terrain-RGB v2** | `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=KEY` | **Yes** | `-10000 + ((R*65536 + G*256 + B) * 0.1)` | 12 | `"mapbox"` | 256/512 | MapTiler ToS | **VERIFIED** 403 "Missing key" without key |
| **Nextzen Terrain** | `https://tile.nextzen.org/tilezen/terrain/v1/terrarium/{z}/{x}/{y}.png?api_key=KEY` | **Yes** | terrarium | 15 | `"terrarium"` | 256 | Nextzen key | **VERIFIED** 400 "API key required" without key |

### Detail
- **AWS Terrain Tiles (keyless winner) — VERIFIED.** `curl -I .../terrarium/10/163/395.png` → 200, `image/png`. Higher zooms live: z12, z14, **z15** all 200. **CORS works**: GET/OPTIONS with `Origin` return `Access-Control-Allow-Origin: *` (a bare HEAD without `Origin` won't echo CORS — normal S3). Two equivalent HTTPS paths both live: virtual-host `elevation-tiles-prod.s3.amazonaws.com/…` and path-style `s3.amazonaws.com/elevation-tiles-prod/…`. EU replica `elevation-tiles-prod-eu` documented. Source: <https://registry.opendata.aws/terrain-tiles/>
- **Data sources** (live `x-amz-meta-x-imagery-sources` header showed `srtm/…`, `gmted/…`, `etopo1/…`, `ned_topobathy/…`; UK tiles showed `uk_lidar/LIDAR-DTM-2M`): SRTM, GMTED2010, ETOPO1, USGS 3DEP/NED, EU-DEM (Copernicus), ArcticDEM, plus national DEMs. Full list + mandatory attribution string: <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>
- **Terrarium formula — VERIFIED:** `elevation_m = (R*256 + G + B/256) - 32768`. Source: <https://github.com/tilezen/joerd/blob/master/docs/formats.md>
- **Nextzen — VERIFIED NOT keyless** (400 "An API key is required"). Same terrarium data as AWS; use AWS instead.
- **MapTiler Terrain-RGB — VERIFIED requires key** (403). Encoding is **Mapbox-style** → MapLibre `encoding: "mapbox"`. Free plan 100k requests/mo (LIKELY). Source: <https://docs.maptiler.com/schema-raster/terrain-rgb/>
- **MapLibre `raster-dem` — VERIFIED** (<https://maplibre.org/maplibre-style-spec/sources/>): `encoding` accepts `"terrarium" | "mapbox" | "custom"`, **default `"mapbox"`**; default `tileSize` **512**. A `raster-dem` source feeds both a `hillshade` layer and the top-level `terrain: { source, exaggeration }`.

### Ready-to-use MapLibre source (AWS terrarium, keyless)
```js
map.addSource("terrainSource", {
  type: "raster-dem",
  tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium",   // REQUIRED — MapLibre defaults to "mapbox"
  tileSize: 256,           // REQUIRED — AWS tiles are 256, MapLibre defaults to 512
  maxzoom: 15,
});
map.setTerrain({ source: "terrainSource", exaggeration: 1.4 });
map.addLayer({ id: "hills", type: "hillshade", source: "terrainSource",
  paint: { "hillshade-exaggeration": 0.3 } });
```
Pixel decode (for manual elevation lookup): `const elevationMeters = (R*256 + G + B/256) - 32768;`

### Gotchas — terrain
- **Encoding mismatch (most common bug):** MapLibre defaults to `"mapbox"`; AWS/Nextzen are **terrarium**. Pass `encoding: "terrarium"` or terrain renders as noise. MapTiler is `"mapbox"`. Don't cross formulas.
- **`tileSize: 256`** — AWS tiles are 256×256; MapLibre's raster-dem default is 512. Wrong value misaligns the DEM.
- **`maxzoom: 15`** so MapLibre overzooms rather than 404-ing past z15.
- **CORS `*` on GET/OPTIONS** — browser fetch works with no proxy; you do NOT need the image/HLS proxy for these.
- **Attribution mandatory** — use the consolidated joerd string (USGS "courtesy of", Copernicus, OGL, CC-BY, national sources). Put it in the map attribution control.
- **`geotiff`/`normal` are not for raster-dem** — `normal` = surface normals, `geotiff` = raw float (512px GIS). Use `terrarium`.

Sources: <https://registry.opendata.aws/terrain-tiles/>, <https://github.com/tilezen/joerd/blob/master/docs/formats.md>, <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>, <https://maplibre.org/maplibre-style-spec/sources/>, <https://docs.maptiler.com/schema-raster/terrain-rgb/>.

---

## 4. Free Routing Engines (route planning)

Berlin test coords used for live probes: `13.38886,52.517037 → 13.397634,52.529407`.

| Engine | Endpoint | Auth | Free limits | Profiles | Elevation? | Production ToS | Verification |
|---|---|---|---|---|---|---|---|
| **OpenRouteService** | `https://api.openrouteservice.org/v2/directions/{profile}` | API key (free) | **40 req/min** + **2000 req/day** (directions) | `driving-car`, `cycling-regular/road/mountain/electric`, `foot-walking`, `foot-hiking`, `wheelchair` | **Yes** — `elevation=true` → 3D geom + `summary.ascent/descent` | **Non-commercial/personal**; don't ship key client-side | Limits/ToS fetched; not curl-tested (key) |
| **GraphHopper** | `https://graphhopper.com/api/1/route?...&key=KEY` | API key (free) | **500 credits/day** (1 route = 1 credit) | `car`, `bike`, `racingbike`, `mtb`, `foot`, `hike`, `scooter`, `truck`… | **Yes** — `elevation=true` → `[lon,lat,ele]` + `ascend/descend` | **Non-commercial** (free plan) | Docs fetched; not curl-tested (key) |
| **OSRM demo** | `https://router.project-osrm.org/route/v1/{profile}/{lon,lat};{lon,lat}` | **Keyless** | **≤ 1 req/sec**, "reasonable" use; no SLA | **Car only** on this host; FOSSGIS mirror has real foot/bike | **No** | **Demo only — non-commercial, not production** | **VERIFIED curl** (both mirrors) |
| **Valhalla (OSM-DE / FOSSGIS)** | `https://valhalla1.openstreetmap.de/route` (POST JSON) | **Keyless** | Community fair-use (no published number) | `auto`, `pedestrian`, `bicycle`, `bus`, `truck`, `motor_scooter`… | **Yes** — `elevation_interval` → per-point array (no total ascent) | Fair-use, not production | **VERIFIED curl** (pedestrian + elevation) |
| **Stadia Maps Valhalla** (alt host) | `https://api.stadiamaps.com/route/v1` | API key (free) | **2,500 credits/mo**, routing 20 credits/req (~125 routes/mo) | Valhalla profiles | **Yes** | Free = dev/eval/non-commercial | Docs; not curl-tested (key) |

### Detail
- **OpenRouteService — VERIFIED limits:** ORS backend FAQ states **2000 directions requests/day** and **"any 60s window may only contain 40 directions requests"** (40/min sliding). Source: <https://giscience.github.io/openrouteservice/frequently-asked-questions>. Elevation via `elevation=true` → 3D geometry + `summary.ascent/descent` (SRTM ~90 m) — LIKELY (docs): <https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options>. **ToS — VERIFIED:** standard key is non-commercial; ORS staff discourage embedding one shared key in a distributed/public app, but may grant a quota bump for a genuinely free public app on request: <https://ask.openrouteservice.org/t/how-to-distribute-app-without-api-key/3492>. Signup: <https://account.heigit.org/info/plans>.
- **GraphHopper — VERIFIED:** **500 credits/day**, 1 route (2–10 locations) = 1 credit → ~500 routes/day; free plan non-commercial. Source: <https://www.graphhopper.com/pricing/>, <https://support.graphhopper.com/support/solutions/articles/44000718211-what-is-one-credit->. Elevation via `elevation=true` → `ascend`/`descend` + 3D points. Cleanest option if you specifically need API-returned ascent/descent totals.
- **OSRM demo — VERIFIED via curl:** `…/route/v1/driving/…` → `{"code":"Ok"}` with GeoJSON, 1888 m / 260.4 s. **Profile gotcha — VERIFIED:** on `router.project-osrm.org`, `foot`/`bike` return identical metrics to `driving` (it only serves car). The FOSSGIS mirror `https://routing.openstreetmap.de` hosts real `routed-car`/`routed-bike`/`routed-foot` (foot 1537.7 s / bike 758.5 s / car 260.4 s — VERIFIED). **ToS — VERIFIED:** "Do not exceed 1 request per second", "restricted to reasonable, non-commercial use-cases", "no guarantees wrt uptime, latency, or data updates". Source: <https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server>. No elevation.
- **Valhalla OSM-DE — VERIFIED via curl:** POST to `…/route` returned a full `trip` (1374 s, 1.908 km, turn-by-turn). **Elevation — VERIFIED:** adding `"elevation_interval": 30` returned a real per-point `elevation` array (`[41.5, 41.2, 39.5, 38.3, 36.6, …]` m) — but **no aggregate ascent/descent** (sum deltas yourself). The standalone `/height` endpoint returned `null` in testing; use in-route `elevation_interval`. Fair-use, treat like OSRM demo. Source: <https://routing.openstreetmap.de/about.html>.

### Gotchas — routing
1. **OSRM demo is explicitly NOT for production** (≤1 req/s, non-commercial, no SLA) and **routes all profiles as car** on `router.project-osrm.org`. Use FOSSGIS `routed-foot`/`routed-bike` paths for real walk/bike (still demo/fair-use).
2. **ORS free key = non-commercial; don't ship it client-side.** Proxy through a Next.js route handler so the key stays server-side; quota bump available for free public apps on request.
3. **GraphHopper free = non-commercial, 500 credits/day** — plenty for a portfolio; keep key server-side.
4. **Community Valhalla is fair-use, not an SLA.** Best keyless option that returns walk/cycle routing **and** per-point elevation; self-host (Docker) or use Stadia free tier for reliability.

**Recommendation:** use **ORS or GraphHopper behind a server-side proxy** for the real app (both return elevation + ascent/descent; both free tiers non-commercial, fine for a portfolio); keep keyless OSRM/Valhalla as dev-only fallbacks.

---

## 5. Free Elevation APIs (elevation profiles)

All keyless; every numeric value below is a **live curl response** captured this session. Test coords: London `51.5,-0.12`, Everest-area `27.99,86.93`, Welsh coast `51.3656,-3.1790`.

| API | Endpoint | Key? | Batch limit | Rate limit | Data / accuracy | Verified response | Status |
|---|---|---|---|---|---|---|---|
| **Open-Elevation** | `GET/POST api.open-elevation.com/api/v1/lookup` | No (public) | Undocumented (array) | None published; slow under load | SRTM ~30 m | London **9.0 m**; Everest **8385 m**; coast **0.0 m** | VERIFIED working; **public instance unreliable** |
| **OpenTopoData** | `GET api.opentopodata.org/v1/{dataset}` | No | **100 locations/req** | **1 call/s, 1000 calls/day** | Multi-DEM: srtm30m, aster30m, eudem25m(25 m), ned10m(10 m), nzdem8m(8 m)… | aster30m London **9.0 m**; srtm30m Everest **8315 m**; eudem25m London **5.69 m** | VERIFIED working; **public daily cap** |
| **Open-Meteo** | `GET api.open-meteo.com/v1/elevation` | No (non-commercial) | **100 coords/req** | **<10k/day**, 5k/hr, 600/min, CC-BY | Copernicus DEM GLO-90, **90 m** | London **1.0 m**; Everest **8343 m**; coast **0.0 m** | VERIFIED working |
| **Client-side Terrarium tiles** | `GET elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png` + decode / `map.queryTerrainElevation()` | No | N/A (local decode) | **None** (tile fetches only) | Blended SRTM + local LIDAR (2 m UK seen); zoom-dependent | tile `12/2046/1337.png` → **200 image/png 73.9 KB** | VERIFIED reachable keyless |

### Detail
- **Open-Elevation — VERIFIED working** (GET + POST batch, keyless). The landing page is shifting toward keyed quotas ("1,000 requests/month"), and the public instance is widely reported slow/down — do not put it on a user-facing critical path. Source: <https://open-elevation.com/>
- **OpenTopoData — VERIFIED:** keyless; **public limits: 100 locations/req, 1 call/s, 1000 calls/day** (homepage). Best when you need finer/regional DEMs (eudem25m 25 m EU, ned10m 10 m US, nzdem8m 8 m NZ). Self-hostable (Docker) to remove the cap. Source: <https://www.opentopodata.org/>
- **Open-Meteo — VERIFIED:** keyless for non-commercial; **100 coords/req**, **<10k calls/day**, CC-BY 4.0 + Copernicus DOI `10.5270/ESA-c5d3d65` attribution required; Copernicus GLO-90 (90 m). Source: <https://open-meteo.com/en/docs/elevation-api>, <https://open-meteo.com/en/terms>
- **Client-side DEM sampling — VERIFIED keyless** (tile 200 image/png; UK tile metadata showed 2 m LIDAR source). Decode `(R*256 + G + B/256) - 32768`, or if 3D terrain is enabled use **`map.queryTerrainElevation(lngLat)`** (metres ASL; returns `null` if terrain off; **multiplied by `exaggeration`** — divide it back out; MapLibre GL JS ≥ v3.0.0). Source: <https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/>. **No API, no rate limit** — most scalable for production; resolution tied to tile zoom (sample z12–14+ for smooth profiles).

### Gotchas — elevation
- **Open-Elevation public instance frequently down/slow** and migrating toward keyed quotas — not a critical-path dependency.
- **OpenTopoData public cap (1000/day, 1/s)** throttles any real profile workload (a profile = dozens–hundreds of points); batch 100/req, but self-host or use client-side tiles at scale.
- **Open-Meteo non-commercial without a key**, requires CC-BY + Copernicus DOI attribution.
- **30–90 m DEMs smooth sharp peaks** (all sources returned ~8315–8385 m near Everest, not 8849 m) — fine for relative profiles, not absolute summit altitude.

**Recommendation:** **client-side Terrarium DEM sampling** as the default (no key, no limit, reuses map tiles; `queryTerrainElevation` when terrain is on). **Open-Meteo** for a clean hosted batch fallback; **OpenTopoData** when you need finer regional DEMs (self-host for volume).

---

## 6. Place / POI Search (Geocoding)

Live probes used `User-Agent: TrafficNerd-V2-outdoor-map/1.0`, queries "Ben Nevis" / "Snowdon".

| Service | Endpoint | Key? | Limits | Autocomplete OK? | Attribution | Verification |
|---|---|---|---|---|---|---|
| **Nominatim** | `nominatim.openstreetmap.org/search` & `/reverse` | No (keyless) | **1 req/sec**, single thread/machine, scheduled ≤4/min, must cache | **NO — explicitly forbidden** | OSM/ODbL (`licence` field) | **VERIFIED** curl 200 + policy fetched |
| **Photon (Komoot)** | `photon.komoot.io/api?q=` | No (keyless) | "reasonable" fair-use; throttle/ban if extensive; no SLA | **YES — search-as-you-type + lat/lon bias** | OSM/ODbL | **VERIFIED** curl 200 GeoJSON + bias confirmed |
| **Geocode Maps Co** | `geocode.maps.co/search?q=…&api_key=` | **Yes** | Free key tier (~1/s, ~5k/day) | Limited (OSM front-end) | OSM/ODbL | **VERIFIED** keyless → 401 |
| **LocationIQ** | `…locationiq.com/v1/search` & `/autocomplete` | **Yes** | **5,000/day, 2/sec, 60/min** | **YES** (dedicated endpoint) | OSM + **link back to LocationIQ required** | VERIFIED pricing |
| **Stadia Maps** | `api.stadiamaps.com/geocoding/v2/…` (Pelias) | **Yes** | **200k credits/mo** (~10k geocode / ~200k autocomplete); no card | **YES** (1 credit each) — but **commercial use NOT allowed on free** | OSM/Pelias | VERIFIED pricing |
| **OpenCage** | `api.opencagedata.com/geocode/v1/json` | **Yes** | **2,500/day, 1/sec**; no card | **NO on free** (autosuggest = paid) | OSM + others | VERIFIED pricing |

### Detail
- **Nominatim — VERIFIED:** keyless; curl "Ben Nevis" → 200, first result `natural/peak`, lat 56.7968582 / lon -5.0035260. **Policy (VERIFIED, <https://operations.osmfoundation.org/policies/nominatim/>):** max **1 req/sec**; **valid Referer/User-Agent REQUIRED** (stock library UAs rejected); **autocomplete/type-ahead explicitly FORBIDDEN**; no bulk/distributed use (scheduled ≤4/min), **results must be cached**; OSM attribution required (`licence: "Data © OpenStreetMap contributors, ODbL 1.0"`). Heavy use → self-host/commercial. **Use only for low-volume, cached, server-side lookups.**
- **Photon — VERIFIED:** keyless; returns GeoJSON FeatureCollection; **built for search-as-you-type**; **proximity bias confirmed** (`?q=snowdon&lat=51.5&lon=-0.12` returned London "Snowdon Drive/Crescent" first). Fair-use: "reasonable limit … extensive usage will be throttled or completely banned", self-host for volume. Source: <https://github.com/komoot/photon>
- **Keyed free tiers — VERIFIED pricing:** **LocationIQ** 5k/day, 2/s, has autocomplete, requires a visible link-back (<https://locationiq.com/pricing>). **Stadia** 200k credits/mo (autocomplete 1 credit each ≈ 200k/mo), no card, but **free plan forbids commercial use** (<https://stadiamaps.com/pricing/>). **OpenCage** 2,500/day, but **no free autocomplete** (autosuggest is paid; <https://opencagedata.com/pricing>). **Geocode Maps Co** requires a key (VERIFIED 401).

### Gotchas — geocoding
- **Nominatim WILL bite a public app:** autocomplete banned, 1 req/s, descriptive UA required, no bulk, must cache. Per-keystroke search to Nominatim breaks the policy and risks an IP ban.
- **Photon is the only keyless + autocomplete-legal option** — debounce client-side, self-host if popular (no SLA).
- **Always display `© OpenStreetMap contributors`** — every option is OSM-derived.

**Recommendation:** type-ahead box → **Photon** (keyless, proximity-biased to the viewport); reliability fallback → a keyed free tier (**LocationIQ** or **Stadia**, minding Stadia's no-commercial / LocationIQ's link-back); reserve **Nominatim** for low-volume cached server-side geocoding only.

---

## 7. Ranked Recommendation (per capability)

For a **deployed public portfolio app** that is global + free, here is the single best keyless-or-free-key option per capability, with the one critical integration detail.

| Capability | #1 Pick | Why | Critical integration detail |
|---|---|---|---|
| **Outdoor basemap (global)** | **OpenTopoMap** (keyless) for demo; **MapTiler Outdoor** (free key) for production | OpenTopoMap = true keyless topo look; MapTiler = MapLibre-native vector, 100k loads/mo | OpenTopoMap: add as **raster** source `https://{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png`, **cache hard**, show CC-BY-SA attribution. MapTiler: load `style.json` directly. |
| **Outdoor basemap (UK, genuine OS)** | **OS Maps API "Outdoor" `_3857`** (free OpenData) | The genuine OS topographic style, free up to z16 | Use `Outdoor_3857`, cap `maxzoom: 16`, `?key=` proxied/referrer-locked, show OS logo + `Contains OS data © Crown copyright…`. **Explorer/Leisure 1:25k is Premium + BNG-only + not MapLibre-compatible.** |
| **3D terrain + hillshade** | **AWS Terrain Tiles (terrarium)** (keyless) | Fully keyless, CORS `*`, live to z15, MapLibre-native | `raster-dem` source with **`encoding: "terrarium"` + `tileSize: 256` + `maxzoom: 15`** (both defaults are wrong for these tiles). Include the joerd attribution string. |
| **Routing (walk/cycle/drive)** | **OpenRouteService** (free key) behind a **server-side proxy** | Returns elevation + ascent/descent; rich profiles incl. `foot-hiking`/`cycling-mountain` | `elevation=true`; keep the key in a Next.js route handler (non-commercial key, don't expose). GraphHopper is the equal-best alternative (500 routes/day, returns ascend/descend). |
| **Elevation profile** | **Client-side Terrarium DEM sampling** (keyless) | No key, no rate limit, reuses terrain tiles already loaded | `map.queryTerrainElevation(lngLat)` when 3D terrain is on (**divide out `exaggeration`**), else decode terrarium pixels. Open-Meteo as a hosted batch fallback (100 coords/req, CC-BY). |
| **Geocoding / place search** | **Photon** (keyless) for autocomplete | Only keyless option that is **autocomplete-legal**, with viewport proximity bias | `photon.komoot.io/api?q=…&lat=&lon=` biased to map centre; **debounce**; keyed fallback (LocationIQ/Stadia) for reliability. **Never wire Nominatim to a search box.** |

### Cross-cutting licensing / ToS gotchas that will bite a public deployment

1. **Nominatim heavy-use ban** — 1 req/s, **autocomplete explicitly forbidden**, descriptive User-Agent required, no bulk, must cache. Use Photon for type-ahead; Nominatim only for low-volume cached server-side lookups. (VERIFIED policy)
2. **OSM standard tile policy** — `tile.openstreetmap.org` **prohibits app/bulk/offline/heavy use**. Never use it as your basemap; use OpenTopoMap/CyclOSM (fair-use) or a keyed provider. (VERIFIED policy)
3. **OS Premium gating** — the iconic Explorer/Leisure 1:25k map is **Premium (card required), BNG-only, max zoom 9, no Web-Mercator variant → unusable in MapLibre**. The free MapLibre path is Road/Outdoor/Light `_3857` ≤ z16. Display the OS logo + Crown-copyright string. (VERIFIED)
4. **OSRM demo "no production use"** — `router.project-osrm.org` is ≤1 req/s, non-commercial, no SLA, and **routes every profile as car**. Don't make it a deployed backend. (VERIFIED)
5. **"Keyless" Stadia is domain-authenticated** — raw server-side fetches return 401; works only from registered origins. Its free geocoding/routing tiers also **forbid commercial use**. (VERIFIED)
6. **ORS / GraphHopper free keys are non-commercial and must stay server-side** — proxy through Next.js; a portfolio demo is fine, monetisation is not. (VERIFIED)
7. **Community Valhalla / CyclOSM / HOT are fair-use, not SLAs** — proven fragile (HOT returned 502 during probing). Acceptable for low traffic; self-host or use a keyed provider for reliability. (VERIFIED)
8. **OpenTopoData public cap (1000/day, 1/s) and Open-Meteo non-commercial + CC-BY attribution** — for elevation at scale prefer client-side DEM sampling or self-hosting. (VERIFIED)
9. **Attribution is mandatory everywhere** — `© OpenStreetMap contributors` for all OSM-derived sources; CC-BY-SA for OpenTopoMap; the joerd multi-source string for AWS terrain; CC-BY + Copernicus DOI for Open-Meteo; OS logo + Crown copyright for OS. Build one attribution control that aggregates these per active layer.

### Suggested keyless-first default stack (zero signup, global)

```
Basemap:    OpenTopoMap (raster, cache hard)        + Waymarked Trails overlay (raster)
Terrain:    AWS Terrain Tiles terrarium (raster-dem, encoding:"terrarium", tileSize:256, maxzoom:15)
Elevation:  client-side terrarium decode / map.queryTerrainElevation()
Geocoding:  Photon (debounced, viewport-biased)
Routing:    community Valhalla (keyless, returns per-point elevation) for dev →
            OpenRouteService behind a Next.js proxy for the deployed app
UK overlay: OS Maps "Outdoor" _3857 (free key, ≤z16, proxied) as an optional GB layer
```

This stack ships with **no keys at all** except the optional ORS proxy (routing) and optional OS Outdoor (UK) — both server-side. Every component above was live-probed or sourced this session; re-verify LIKELY-tagged free-tier numbers before launch.
