# TrafficNerd v2 — New camera sources (verified research)

> Research sweep 2026-06-26. Every row below was **live-verified** (endpoint actually fetched and returned real camera data with coordinates) unless tagged otherwise. Feeds the "more cameras" work in the overhaul spec. Keyless-first, rural/highway + global-webcam emphasis.

## A. VERIFIED keyless (build with zero registration)

| Source / operator | Country / coverage | ~Count | API endpoint (lists cameras + coords) | Image URL pattern | Format | Key gotcha | Conf. |
|---|---|---|---|---|---|---|---|
| **Castle Rock "511" platform** (one adapter → many systems) | FL, GA, NY (US); Ontario, Alberta, Nova Scotia, New Brunswick (CA); Idaho; New England (ME/NH/VT). Highway+rural, statewide | **~13–14k total** (FL 4881, GA 4043, NY 2293, ON 932, ID 457, NewEngland 403, AB 356, NS 57, NB 57) | `POST https://{site}/List/GetData/Cameras` — body `draw=1&start=0&length=99999`, headers `Content-Type: application/x-www-form-urlencoded` + `X-Requested-With: XMLHttpRequest` | `https://{site}/map/Cctv/{imageId}` (snapshot JPEG, no referer/cookie) | JSON | Coords are WKT `POINT (lon lat)` — **lon first**. MUST be POST (GET → empty). Skip `videoUrl` HLS (auth-gated `isVideoAuthRequired`). Do NOT use `api/v2/get/cameras` (key-gated) — the website `List` POST is the keyless path. | VERIFIED |
| **Oregon TripCheck** (ODOT) | US Oregon, highway+rural, statewide | ~1127 | `GET https://tripcheck.com/Scripts/map/data/cctvinventory.js` (ESRI FeatureSet JSON) | `https://tripcheck.com/RoadCams/cams/{filename}` | JSON (served as .js) | Use the named `latitude`/`longitude` float attrs (plain WGS84) — ignore the `wkid:3857` label. Image loads with no referer. | VERIFIED |
| **DriveBC** (BC MoTI) | Canada BC, highway+rural, statewide | ~1058 | `GET https://www.drivebc.ca/api/webcams/` | `https://www.drivebc.ca` + `links.imageDisplay` (`/images/{id}.jpg`) | JSON | `location.coordinates` is `[lon, lat]` (GeoJSON, lon-first). Prefix relative image path. `marked_stale`/`marked_delayed` flag dead cams. | VERIFIED |
| **NZTA / Waka Kotahi** | New Zealand, state highways (motorway+rural), nationwide | 320 | `GET https://trafficnz.info/service/traffic/rest/4/cameras/all` (send `Accept: application/json`) | `https://trafficnz.info` + `imageUrl` (`/camera/{id}.jpg`) | XML or JSON | Use the camera node's `<latitude>/<longitude>`, NOT the nested journey start/end coords. No CORS → use the image proxy. Sample: id 714 "SH1 Tinwald" lat -43.919632 lon 171.721055. | VERIFIED |
| **Iceland — Vegagerðin** | Iceland, road-weather + mountain passes + ring road, nationwide | ~200 stations (1–4 views each) | `GET https://gagnaveita.vegagerdin.is/api/vefmyndavelar2014_1` (follow http→https 302) | `Slod` field = full JPEG URL; cache-bust `?time={epoch_ms}` | JSON | Flat rows: **group by `Maelist_nr`** for one marker/station. `Breidd`=lat, `Lengd`=lon (ignore PntX/Y ISN93). Cleaner alt: `umferdin.is/en/cameras` `__NEXT_DATA__` is pre-grouped with `coordinates:{lat,lon}`. | VERIFIED |
| **Estonia — Tark Tee** (Transpordiamet) | Estonia, road-weather (highway+rural), nationwide | 179 | `GET https://tarktee.transpordiamet.ee/tarktee/rest/services/tram/road_cameras/MapServer/0/query?where=1=1&outFields=*&outSR=4326&f=json` | `https://tarktee.transpordiamet.ee/images/{image_path}` | ArcGIS JSON/GeoJSON | Use the **`tram/`** folder (root layer is frozen/stale). `image_path` has an embedded timestamp that changes each update → **re-query per refresh, don't cache the path**. Bonus air/road temp fields. | VERIFIED |
| **Scotland — Traffic Scotland** | Scotland, trunk roads/motorways, nationwide | 414 | `GET https://www.traffic.gov.scot/tsis/cameras` (`results[]` has `sid,title,lat,lng,roadname`) | `https://www.traffic.gov.scot/tsis/camerahtml?sid={sid}&title={title}` → HTML with **base64 JPEG** | JSON list + HTML/base64 image | Image is NOT a direct .jpg — adapter must fetch the HTML and extract the `data:image/jpeg;base64,...` URI (no `cameraimage` endpoint — 404). | VERIFIED |
| **Wales — Traffic Wales** (images only) | Wales, motorway/trunk, nationwide | ~200 | Per-camera coords need the free DATEX feed (registration) | `https://members.traffic.wales/cctvimages/camera{ID}.jpg` (keyless, no auth despite "members.") | JPEG / DATEX XML for coords | Images verified keyless; **coordinates require free DATEX registration** or a hardcoded coord table. | Images VERIFIED, coords LIKELY |
| **Belgium / Wallonia — Trafiroutes** (SPW) | Wallonia motorways/main roads | ~215 | No clean keyless coord JSON (server-rendered JSF map) | `https://trafiroutes.wallonie.be/images_uploaded/cameras/{id}.jpg` | images only | Images keyless+verified, but **no machine-readable coords feed** → weak unless scraped/geocoded. | Images VERIFIED, coords UNVERIFIED |

## B. VERIFIED but FREE-KEY (register once)

| Source | Country / coverage | ~Count | Endpoint | Auth / how to get key | Format | Conf. |
|---|---|---|---|---|---|---|
| **Sweden — Trafikverket Trafikinfo** | Sweden, highways, nationwide | ~1600 | `POST https://api.trafikinfo.trafikverket.se/v2/data.json` body `<REQUEST><LOGIN authenticationkey="KEY"/><QUERY objecttype="Camera" schemaversion="1"><FILTER/></QUERY></REQUEST>` (`Content-Type: text/xml`) | Free key instantly at api.trafikinfo.trafikverket.se ("Skapa konto") | XML req → JSON | `Geometry.WGS84` = `POINT (lon lat)` (lon-first), `PhotoUrl` (+`?type=fullsize`), `PhotoTime`. | VERIFIED schema |
| **Norway — Statens vegvesen CCTV** | Norway, passes/ferries/highways, nationwide | ~400+ | `https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetCCTVSiteTable/pullsnapshotdata` | Free Basic-Auth creds (register: vegvesen.no open-data DATEX get-access) | Datex II 3.1 XML | NLOD licence (attribution). Image URLs inside the feed (`webkamera.atlas.vegvesen.no`). | VERIFIED auth/format |
| **Australia — Transport for NSW** | NSW, Sydney metro + highways/regional | (large) | `GET https://api.transport.nsw.gov.au/v1/live/cameras` | Free key at opendata.transport.nsw.gov.au; header `Authorization: apikey <KEY>` | GeoJSON | Image URL + GPS coords in `properties`. | LIKELY (key-gated) |
| **Australia — QLDTraffic** (TMR) | QLD, Brisbane + highways, statewide | (large) | `GET https://api.qldtraffic.qld.gov.au/v1/webcams?apikey=<KEY>` | Free key by email to QLDTraffic@tmr.qld.gov.au | GeoJSON | Use `/v1/webcams` (not `/v2/webcam`). | LIKELY (key-gated) |
| **Windy Webcams API v3** | **Global** — tourism/ski/beach/harbor/pass/city-square webcams | ~70k+ | `GET https://api.windy.com/webcams/api/v3/webcams?bbox={N},{E},{S},{W}&include=images,location,player&limit=50&offset=0` | Free key at api.windy.com/keys; header `x-windy-api-key: <KEY>` | JSON | `bbox` = N,E,S,W. `limit≤50`, `offset≤1000` free → paginate. `imageUrl = images.current.preview` (JPEG stills). **Image URL token expires 15 min** (re-fetch list); free tier low-res. **Attribution MANDATORY**: "Webcams provided by Windy.com" + per-image link back. | VERIFIED schema |
| **Washington — WSDOT** | US WA, highways, statewide | (large) | `GET https://www.wsdot.wa.gov/Traffic/api/HighwayCameras/HighwayCamerasREST.svc/GetCamerasAsJson?AccessCode={KEY}` | Free AccessCode (email signup) | JSON | lat/lon + ImageURL with key. Lower priority. | LIKELY (key-gated) |

## C. DEAD ENDS (don't waste time — with the reason)

- **Germany — Autobahn GmbH**: API alive but the webcam endpoint returns `{"webcam":[]}` for all ~60 roads — emptied/deprecated.
- **Denmark — Vejdirektoratet**: webcams deliberately removed from public access.
- **Netherlands — NDW**: no camera image feed in open data (GDPR). (Matches earlier flag.)
- **Ireland — TII**: no national camera feed; only Fingal CC's ~6 markers, no image URLs.
- **Switzerland**: ASTRA = traffic counters only; MeteoSwiss webcam layer has no queryable lat/lon+image table (~35 cams, low ROI).
- **Austria — ASFINAG** (~1267) and **Czech — RSD/JSDI**: real but behind mandatory free registration (DATEX portals) — revisit only if registering.
- **Belgium — Flanders**: open feed is sensor data only; images gated behind itsme key.
- **Australia VIC / WA / SA**: VIC runtime-injected API GW (no static path); WA no public camera endpoint; SA WAF-403 blocked.
- **Quebec 511, Utah, Iowa, Wisconsin, Manitoba, Saskatchewan, PEI**: NOT on Castle Rock (different vendors / WAF / SPA) — bespoke scraping, skip.
- **Skyline Webcams, RoundShot, WorldCam**: no open/aggregate API (embed-only / ToS-restricted).
- **webcams.travel**: gone — 301s into Windy. Use Windy v3.

## D. Final ranked shortlist (coverage value × ease of integration)

1. **Castle Rock "511" platform** — ~13–14k cameras across 9 systems (US + 4 Canadian provinces) from **one parameterized adapter**, fully keyless. *Key detail:* `POST /List/GetData/Cameras` (DataTables body), parse coords from WKT `POINT (lon lat)` — **longitude first** — image snapshot `https://{site}/map/Cctv/{id}`, not the auth-gated HLS.
2. **Oregon TripCheck** — ~1127 keyless, simplest schema. GET `cctvinventory.js`, use plain `latitude`/`longitude`, image `https://tripcheck.com/RoadCams/cams/{filename}`.
3. **DriveBC (BC)** — ~1058 keyless, clean JSON. `location.coordinates` is `[lon, lat]`; prefix images with `https://www.drivebc.ca`.
4. **NZTA New Zealand** — 320 keyless, new country/hemisphere. GET `/cameras/all` with `Accept: application/json`; use the camera node's own lat/lon.
5. **Windy Webcams (free key)** — the entire "global webcams" requirement (tourism/ski/beach/harbor/pass) in one source, ~70k+. Paginate `bbox`+`limit=50`+`offset`, map `images.current.preview`→imageUrl, re-fetch <15 min (token expiry), **mandatory Windy.com credit + per-image link back**.
6. **Sweden Trafikverket (free key)** — ~1600 cameras, new country. POST the XML `<REQUEST>` querying `objecttype="Camera"`; parse `Geometry.WGS84 = POINT (lon lat)` and `PhotoUrl`.
7. **Iceland Vegagerðin** — ~200 keyless rural/mountain-pass cams. Group flat rows by `Maelist_nr`; or use pre-grouped `umferdin.is` `__NEXT_DATA__`.
8. **Estonia Tark Tee** — 179 keyless, ArcGIS standard. Query the **`tram/`** layer with `outSR=4326`, re-query per refresh (timestamped `image_path`).

**Honorable mentions:** Scotland Traffic Scotland (414 keyless, base64-in-HTML), Norway Statens vegvesen (~400, Basic-Auth + Datex II XML), Australia NSW + QLD (free keys, clean GeoJSON).

## Cross-cutting implementation notes

- Nearly all road feeds are **JPEG snapshots, not HLS** → set `imageUrl` + `refreshSeconds` 60–300.
- Several put **longitude before latitude** (Castle Rock WKT, DriveBC, Sweden) — easy to swap by accident; normalize carefully.
- Media is already proxied server-side, so source CORS is a non-issue; all keyless snapshots above loaded with no referer/cookie.
- Allowlist each new host in `lib/proxy/allowlist.ts` (host + path/suffix).
- **Keyless-first build order:** Castle Rock → TripCheck → DriveBC → NZTA → (Iceland, Estonia, Scotland). Free-key sources (Windy global webcams, Sweden, Norway, AU) come after, gated on the user obtaining keys.
