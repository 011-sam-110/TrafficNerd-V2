# TrafficNerd v2 — US cameras + live video design

**Date:** 2026-06-26
**Status:** Approved (design confirmed by user) → spec review
**Builds on:** P0 skeleton (`feat/p0-skeleton`) — pluggable `Source` adapters, `Camera` zod schema, source registry, closed SSRF-safe image proxy, camera detail page + in-globe feed overlay.
**Branch:** `feat/us-cameras` (off `feat/p0-skeleton`).

## Goal

Extend camera coverage from London (TfL) to the **United States — California and South
Carolina** — and, crucially, surface **real live video** for the US cameras, not just
still images. Both state feeds expose live **HLS** (`.m3u8`) streams, so "real video" is
achievable end-to-end.

The existing `Camera` schema is already `country`/`region`-aware and sources are
pluggable, so this is mostly: two new adapters + a multi-source registry merge + a
streaming proxy + an HLS-capable player. No API keys anywhere.

## Verified data sources (no key — reachable & inspected 2026-06-26)

| State | Registry endpoint | Per-camera fields | Video | Still |
|---|---|---|---|---|
| **California** (Caltrans) | `https://cwwp2.dot.ca.gov/data/d{N}/cctv/cctvStatusD{N}.json`, districts 1–12 | `location.latitude/longitude`, `locationName`, `nearbyPlace`, `county`, `route`, `direction`, `inService`, `currentImageUpdateFrequency` | `imageData.streamingVideoURL` → HLS on `wzmedia.dot.ca.gov` | `imageData.static.currentImageURL` (JPEG) on `cwwp2.dot.ca.gov` |
| **South Carolina** (SCDOT / Iteris) | `https://sc.cdn.iteris-atis.com/geojson/icons/metadata/icons.cameras.geojson` (one GeoJSON) | `geometry.coordinates [lon,lat]`, `description`, `name` (device #), `id` (UUID), `route`, `direction`, `jurisdiction`, `active`, `problem_stream` | `https_url` (= `ios_url`) → HLS on `s18/s19/s20.us-east-1.skyvdn.com` | `image_url` (PNG) on `scdotsnap.us-east-1.skyvdn.com` |

**Observed scale:** Caltrans D11 alone = 324 cameras (236 with video); SC = 760 cameras,
all active, all with HLS. All 12 CA districts ≈ several thousand cameras.

### Critical streaming facts (these shape the proxy design)

- **Caltrans video (`wzmedia.dot.ca.gov`) is hotlink-protected.** A bare request 404s /
  is blocked; a request carrying `Referer: https://cwwp2.dot.ca.gov/` returns `200` + a
  valid HLS master playlist **and** `Access-Control-Allow-Origin: *`. A browser cannot
  forge that cross-origin Referer, so CA video **must be proxied** server-side with the
  Referer injected.
- **SC video (`*.us-east-1.skyvdn.com`) works bare** (`200`, `CORS *`, no Referer
  needed). It is proxied too, for consistency, closed-proxy SSRF safety, and to hide the
  user's IP from the source.
- **Caltrans districts flake** — districts return transient `500`s (only d10–d12
  responded on one probe; d11 served reliably on others). The CA adapter must tolerate
  per-district failure.
- HLS shape (both hosts): `playlist.m3u8` (master, references a relative
  `chunklist_*.m3u8`) → `chunklist_*.m3u8` (media playlist, references relative
  `media_*.ts` segments). The proxy must rewrite the relative URIs at each level.

## Architecture

A single closed proxy already exists for stills. We add a parallel **HLS proxy**, two
source adapters, and a video-capable detail component. Everything degrades gracefully.

### New / changed units

| Unit | Type | Responsibility |
|---|---|---|
| `lib/sources/caltrans.ts` | new | `CALTRANS_SOURCE` + `normalizeCaltrans()` + `fetchRegistry()` (all 12 districts, resilient) |
| `lib/sources/scdot.ts` | new | `SCDOT_SOURCE` + `normalizeScdot()` + `fetchRegistry()` (one GeoJSON) |
| `lib/sources/registry.ts` | change | merge TfL + Caltrans + SCDOT via `Promise.allSettled`; stale-cache fallback |
| `lib/proxy/allowlist.ts` | change | add still-image rules for `cwwp2.dot.ca.gov` + `scdotsnap…` |
| `lib/proxy/hls-allowlist.ts` | new | streaming-host allowlist **+ per-host Referer** to inject |
| `lib/proxy/hls-rewrite.ts` | new | pure playlist-rewriter (relative/absolute URI → `/api/hls?u=…`) |
| `app/api/hls/route.ts` | new | the HLS proxy (resolve → fetch w/ Referer → rewrite playlist / stream segment) |
| `components/CameraVideo.tsx` | new | hls.js `<video>` with poster + **still fallback on stream error** |
| `components/CameraDetail.tsx` | change | choose `CameraVideo` vs `CameraImage` by `mediaType` |
| `app/camera/[id]/page.tsx` | change | same choice on the standalone page |
| `app/api/camera/[id]/route.ts` | change | ensure response carries `mediaType` (never the raw `streamUrl`) |
| `app/api/cameras/route.ts` | change | add `country` to the slim list (for legend counts / future colouring) |
| `package.json` | change | add `hls.js` dependency |

### Adapter normalization (→ canonical `Camera`)

Both adapters are pure `normalize*()` functions (unit-testable from a fixture) wrapped by
a `fetchRegistry()`. Common rules: validate lat/lon are finite and in range; **skip any
record with neither an image nor a stream**; `id` is `${source}:${nativeId}`.

**Caltrans** (`record.cctv` per district):
- `id`: `caltrans:d{district}-{index}` · `country`: `US` · `region`: `California`
- `name`: `locationName` (fallback `nearbyPlace`) · `road`: `route` · `direction`: `direction`
- `lat/lon`: `parseFloat(location.latitude/longitude)`
- `imageUrl`: `currentImageURL` if present · `streamUrl`: `streamingVideoURL` if non-empty
- `mediaType`: `streamUrl ? "both" : "jpeg"`
- `refreshSeconds`: `max(30, currentImageUpdateFrequency*60)` else `60`
- `available`: `inService === "true"`

**SCDOT** (per GeoJSON feature):
- `id`: `scdot:{name}` (device #; fallback `properties.id`) · `country`: `US` · `region`: `South Carolina`
- `name`: `description` (fallback `name`) · `road`: `route` · `direction`: `direction`
- `lat`: `coordinates[1]` · `lon`: `coordinates[0]`
- `imageUrl`: `image_url` · `streamUrl`: `https_url` (fallback `ios_url`)
- `mediaType`: `streamUrl ? "both" : "jpeg"`
- `available`: `active === true && problem_stream !== true`
- `refreshSeconds`: `60`

`fetchRegistry()`: Caltrans fans out over the 12 districts with `Promise.allSettled` and
concats whatever succeeded (a `500` district is silently skipped); SCDOT fetches the one
GeoJSON (sending a `Referer` defensively). Each returns `CameraArray.parse(...)`. Neither
throws on partial data — only on a total, unrecoverable failure.

### Registry merge (resilience)

`getRegistry()` keeps its 5-min TTL cache but now fans out over **all** sources:

```
const results = await Promise.allSettled([tfl(), caltrans(), scdot()])
const cameras = results.filter(fulfilled).flatMap(r => r.value)
if (cameras.length === 0) return staleCache ?? throw   // never blank the globe silently
cache = { cameras, at: now }
```

One source down ⇒ the others still render. Total failure ⇒ serve the last good cache if
we have one.

### HLS proxy — `GET /api/hls`

The core new piece. Two entry shapes:
- `?id=<cameraId>` → look up the camera, use its `streamUrl` as upstream (the player's
  initial `src`; the raw stream URL never reaches the client).
- `?u=<absolute upstream URL>` → used by rewritten playlist/segment links.

Flow:
1. Resolve upstream URL (from `id` or `u`).
2. **SSRF check** via `isHlsAllowed(url)` → `{ ok, referer }`; `403` if not allowed.
   Allowlist (host + path prefix + the Referer to inject):
   - `wzmedia.dot.ca.gov` · `/` · Referer `https://cwwp2.dot.ca.gov/`
   - `*.us-east-1.skyvdn.com` (suffix) · `/rtplive/` · Referer `https://www.511sc.org/`
3. `fetch(upstream, { headers:{ Referer, "User-Agent", Accept }, redirect:"error",
   cache:"no-store", signal: AbortSignal.timeout(10_000) })`, forwarding any incoming
   `Range` header. `502` on failure / non-OK (segments may legitimately return `200`/`206`).
4. **If playlist** (content-type `…mpegurl`, or URL ends `.m3u8`, or body starts
   `#EXTM3U`): rewrite via `lib/proxy/hls-rewrite.ts` — each non-`#`, non-empty line is a
   URI; resolve it against the upstream URL (`new URL(line, upstream)`) and replace with
   `/api/hls?u=${encodeURIComponent(resolved)}`. Also rewrite the `URI="…"` of any
   `#EXT-X-KEY` line (defensive; these streams are unencrypted). Serve as
   `application/vnd.apple.mpegurl`, `Cache-Control: no-store` (live).
5. **Else (segment / binary):** stream `upstream.body` straight through (a
   `ReadableStream`, **not** buffered), preserving status `200`/`206` and passing through
   `Content-Type` (default `video/mp2t`), `Content-Length`, `Content-Range`,
   `Accept-Ranges`. `Cache-Control: public, max-age=5`.

`GET` only; `redirect:"error"` blocks redirect-based allowlist bypass.

### Video player — `components/CameraVideo.tsx`

`"use client"`. Renders `<video controls autoPlay muted playsInline poster={proxied
still}>`. In an effect:
- **hls.js is dynamically imported inside the effect** (`(await import("hls.js")).default`)
  so its `window` references never run during SSR (same care satellite.js needed).
- If `video.canPlayType("application/vnd.apple.mpegurl")` (Safari native HLS) → set
  `video.src = "/api/hls?id="+id`.
- Else if `Hls.isSupported()` → `new Hls()`, `loadSource("/api/hls?id="+id)`,
  `attachMedia(video)`; on a **fatal** `Hls.Events.ERROR` → tear down and set
  `failed=true`.
- Cleanup destroys the hls instance on unmount.
- If `failed` → render `<CameraImage>` (the refreshing still) instead, so an offline
  camera still shows something.
- The mandatory `<AttributionBadge>` is always rendered.

### Detail wiring

`/api/camera/[id]` already returns the full camera; we ensure `mediaType` is in the
payload (and deliberately **omit** the raw `streamUrl` — the client streams via
`/api/hls?id=`). `CameraDetail` and `/camera/[id]/page.tsx` render `CameraVideo` when
`mediaType !== "jpeg"`, else `CameraImage` (unchanged path for TfL stills).

Only the **one selected** camera ever mounts a player, so there is no many-streams
performance blow-up on the globe.

## Data flow (US video, happy path)

```
registry (TfL+Caltrans+SCDOT, 5-min cache)
  → /api/cameras (slim points)            → globe renders all cameras
  → click → /api/camera/[id] (mediaType)  → CameraVideo
       poster: /api/proxy?id=…  (still, existing image proxy)
       video:  /api/hls?id=…
                 → resolve streamUrl → fetch master.m3u8 w/ Referer
                 → rewrite chunklist URI → /api/hls?u=chunklist
                 → rewrite media_*.ts URIs → /api/hls?u=segment (Range passthrough)
                 → hls.js renders LIVE video
```

## Error handling & resilience

- **Source failure** → `allSettled`; other sources render; total failure → stale cache.
- **Caltrans district 500** → skipped per-district.
- **Bad record** (non-finite/out-of-range coords, no image & no stream) → skipped in normalizer.
- **HLS upstream failure** → `502`; player's fatal-error handler → still-image fallback.
- **SSRF** → image allowlist + separate HLS allowlist, both host+path; `redirect:"error"`; http/https only.
- **Attribution** is never optional — the badge renders in both video and image paths.

## Testing

**Unit (vitest):**
- `normalizeCaltrans` fixture → expected `Camera[]` (id format, `country/region`,
  `mediaType:"both"`, `available` mapping, invalid-record skip).
- `normalizeScdot` fixture → expected `Camera` (`description` as name, `active &&
  !problem_stream`, **coord order lon/lat**).
- `registry` merge: 3 mocked sources, one rejects → union of the other two; all reject +
  cache present → stale cache returned.
- `isHlsAllowed`: wzmedia + skyvdn allowed with correct Referer; other host / wrong path /
  non-http → rejected.
- `hls-rewrite`: master→chunklist relative URI rewritten; chunklist→`media_*.ts`
  rewritten; `#` lines untouched; absolute URI resolved correctly; `#EXT-X-KEY` URI rewritten.
- `isAllowed` (stills): new hosts allowed at their prefixes; traversal / other host rejected.

**E2E (playwright):**
- `/api/cameras` count exceeds the TfL-only baseline (US cameras present).
- Open a US camera detail → a `<video>` element is present; `/api/hls?id=…` returns a
  `mpegurl` body and a follow-up segment request returns `video/mp2t`. (Live HLS in CI is
  flaky → assert the proxy/rewrite contract against a known id, gating any real-stream
  playback assertion.)
- Dead-stream id → `CameraImage` fallback rendered.

## Out of scope (YAGNI)

- RTMP / RTSP / `clsps` protocols — only HLS (`https_url` / `streamingVideoURL`).
- DVR / seeking / historical playback — live only.
- Other US states or other countries.
- Server-side transcoding / re-muxing.
- Video on globe markers or many simultaneous tiles — only the selected detail plays.
- Audio — traffic cams are silent; muted autoplay.
- Authn / rate-limiting of our own proxy (future hardening).

## Risks

- **wzmedia hotlink policy could change** (different required Referer) → it is centralized
  in `hls-allowlist.ts`, a one-line change.
- **Segment bandwidth flows through our server** (Vercel) → fine at P0 demo scale; note
  edge/CDN offload for scale.
- **Stream churn** (cameras go offline) → still-image fallback absorbs it.
- **Serverless streaming of `.ts`** must stream, not buffer → enforced by passing
  `upstream.body` through directly.
