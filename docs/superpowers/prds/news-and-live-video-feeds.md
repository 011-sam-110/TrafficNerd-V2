# PRD: News aggregation + live video feeds
> Priority: P2 · Effort: M · Status: Proposed · Category: data-layer

## 1. Summary
Two complementary additions. (1) A **persistent single-instance HLS video player** so that opening a live camera stream re-uses one long-lived `<video>`+`hls.js` engine instead of mounting/destroying one per dossier — swapping the source on channel change, pausing when the tab is hidden or after idle, to save bandwidth across our ~3,300 feeds. (2) A **lightweight transport-news strip**: a managed firehose of keyless RSS feeds (aviation, maritime, rail, road incidents) parsed server-side, with a SOURCES on/off manager. Together they bring worldmonitor's "persistent player + sources manager" pattern into TrafficNerd's transport domain.

## 2. Why it matters for TrafficNerd
The dossier already plays HLS via `components/CameraVideo.tsx`, but each open spins up a fresh `hls.js` instance and tears it down on close — wasteful when a user clicks rapidly through cameras. A persistent player makes camera browsing instant and cheap, and is the single biggest bandwidth lever once we scale feeds. The news strip adds *context*: a Heathrow runway-closure or a Baltic shipping incident is exactly the kind of event a viewer wants explained while watching the relevant cameras/planes/ships move. It deepens the "watch the world move" pitch without a new map layer.

## 3. worldmonitor.app reference
worldmonitor curates 500+ feeds across 15 categories with a SOURCES manager (search, per-source toggles, Select All/None, an "45/77 enabled" counter, fetch-time disabling to save bandwidth), and a Live News Video panel embedding Bloomberg/Sky/DW etc. via the YouTube IFrame API as a *persistent* player (no reload on mute/play/channel change) with tab-visibility + 5-min idle auto-pause. We adapt the **persistent-player technique to HLS camera streams** and ship a **transport-scoped** (not general-news) feed manager; we do **not** embed YouTube broadcast channels.

## 4. How we build it (TrafficNerd-specific)

### Data sources (keyless)
RSS/Atom only, parsed server-side: AVHERALD (aviation incidents), NOTAM/FAA & UK NATS advisories where RSS exists, gCaptain + Maritime Executive (maritime), Network Rail / National Highways feeds (UK), and Digitraffic traffic-message JSON (already trusted). All are public RSS; no keys.

### Files to ADD
- `lib/news/sources.ts` — static `NEWS_SOURCES` registry: `{ id, label, category, feedUrl, enabledByDefault }`. Single source of truth.
- `lib/news/fetchNews.ts` — server-only: fetch each *enabled* feed with `AbortSignal.timeout`, parse with **fast-xml-parser** (new dep), normalize to `NewsItem { id, title, link, category, source, publishedAt }`, merge via `Promise.allSettled` with in-process cache + stale fallback (mirror `lib/sources/adsb.ts`).
- `app/api/news/route.ts` — `dynamic="force-dynamic"`; `GET ?sources=a,b` → `{ count, items }`, never throws.
- `lib/news/useNews.ts` — client store polling `/api/news` every ~120s (`useSyncExternalStore`, keep-last-good), passing the enabled-source set.
- `lib/news/useSourceManager.ts` — external store persisting enabled IDs to `localStorage`; drives the "45/77 enabled" counter and is read by `useNews` so disabled feeds aren't fetched.
- `components/PersistentPlayer.tsx` — one mounted `<video>`+`hls.js` (context/store-held) with `play(cameraId)` swapping `instance.loadSource('/api/hls?id=…')`; `Page Visibility` + 5-min idle timer call `video.pause()`.
- `lib/video/playerStore.ts` — `useSyncExternalStore` holding `{ activeId }`; `CameraDetail` calls `setActive(id)` instead of mounting its own video.
- `components/NewsStrip.tsx` — bottom ticker row + expandable panel; `components/SourceManager.tsx` — search + per-source toggles + Select All/None.
- `lib/news/fetchNews.test.ts` — RSS-fixture parse/normalize assertions.

### Files to CHANGE
- `components/CameraDetail.tsx` / `CameraVideo.tsx` — delegate playback to `PersistentPlayer` via `playerStore`; keep `CameraImage` fallback for jpeg-only feeds.
- `lib/proxy/hls-allowlist.ts` — unchanged (player still routes through `/api/hls`); add any news *image* host to `lib/proxy/allowlist.ts` only if thumbnails are shown.
- `app/page.tsx` — mount `<PersistentPlayer>` once near root; add `<NewsStrip>` to the bottom shell.
- Command palette — add "Toggle News" + "Manage news sources" actions.

### UX
News strip lives in the bottom data-freshness shell: a scrolling ticker, click an item → opens `link` in a new tab. Empty = "No transport news from enabled sources"; loading = `—` count; error = keep last good silently. SourceManager is a slide-in with search, category groups, Select All/None, and the `enabled/total` counter; toggling off stops that feed being fetched next cycle. Player: muted-autoplay on first activate (browser policy), pauses on tab-hide and after 5 min idle, resumes on next activate.

### SSRF/proxy
All RSS fetched **server-side** in `/api/news`; the client never receives a feed URL. Camera video continues through the closed `/api/hls` proxy — no raw `streamUrl` ever reaches the client.

## 5. Dependencies & prerequisites
- New dep: `fast-xml-parser` (RSS/Atom). Reuses `hls.js`, `zod`, `useSyncExternalStore`, existing `/api/hls` proxy.
- Soft-depends on the dark-ops-console shell (`dark-ops-console-shell`) and data-freshness ticker (`data-freshness-ticker`) for placement.

## 6. Risks & mitigations
- **RSS flakiness / ToS** — `Promise.allSettled` + 120s server cache + stale fallback; honest per-source error state; polite `User-Agent`.
- **Persistent player edge cases** — single instance must `loadSource` (not re-`new Hls`) on swap; on fatal error fall back to `CameraImage`; destroy only on full unmount.
- **Autoplay policy** — start muted; require a user gesture (the dossier click) before first play.
- **CORS** — none client-side; all cross-origin fetches are server-side and proxied.

## 7. Acceptance criteria
- [ ] `GET /api/news` returns `{ count, items: NewsItem[] }`, honors `?sources=`, never 500s.
- [ ] Disabling a source in SourceManager stops it being fetched (verified via network/log); counter shows `enabled/total`; selection persists across reload.
- [ ] Clicking through multiple cameras re-uses ONE `hls.js` instance (verified: no per-open create/destroy churn).
- [ ] Player pauses on tab hide and after 5 min idle; resumes on next activate.
- [ ] No raw `streamUrl` or feed URL reaches the client; `npm run build`, lint, and `fetchNews` tests pass.
- [ ] Solo-attributed commit (no Claude trailer).

## 8. Out of scope / future
Embedded YouTube/broadcast video; general (non-transport) news; geo-pinning news items onto the map; per-item AI summaries; full 500-feed catalogue (ship a curated ~15-source transport set first); WebSocket push.
