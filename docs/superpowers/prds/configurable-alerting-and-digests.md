# PRD: Configurable alert rules & scheduled digests
> Priority: P3 · Effort: L · Status: Proposed · Category: alerting

## 1. Summary
An optional power-user layer that lets a viewer define **alert rules** over the live `WorldObject` stream ("any military aircraft enters this bbox", "camera Y has been offline > 10 min", "> N planes over this region") and receive **scheduled AI-summarized digests** (busiest hour, notable flights, offline-camera count) on their own channel. v1 ships **Telegram** delivery (reusing Sampo's existing bot tooling) plus a free in-browser notification path. Rules and digests run from a single Vercel Cron job evaluating against the same keyless adapters the map already uses — no new data sources, no signup, no paid tier.

## 2. Why it matters for TrafficNerd
The map answers "what is happening *now, where I'm looking*". Alerting answers "tell me when something I care about happens *while I'm not looking*". For a transport console that is the difference between a toy and a tool: a planespotter wants a ping when a `military`-classified contact (from `lib/planes/classify.ts`) crosses their bbox; an ops-minded user wants to know when a JamCam region goes dark; everyone enjoys a once-a-day "busiest hour was 17:00, 3 notable flights, 4 cameras offline" recap. It also showcases real engineering depth (rules engine + scheduler + safe outbound delivery) for portfolio value, while staying strictly behind YAGNI for the core map.

## 3. worldmonitor.app reference
worldmonitor's Pro tier offers an "Alert rules engine — custom triggers, quiet hours, AES-256 encrypted channels" and an "AI digest — daily/twice-daily/weekly to Slack, Discord, Telegram, Email or webhook" delivering up to 30 ranked, deduped items per send with an AI assessment and "signals to watch". We adapt the **shape** (user-defined triggers + quiet hours + scheduled AI digest to an external channel) to our transport objects and our keyless, single-cron budget — not its multi-channel breadth or encryption-at-rest claims.

## 4. How we build it (TrafficNerd-specific)

**Data sources / endpoints (all keyless, already wired):** no new outbound *data* calls. Rules evaluate against the existing server fetches in `lib/sources/registry.ts` (cameras), `lib/sources/adsb.ts` (planes, with `lib/planes/classify.ts` categories), and `lib/sources/celestrak.ts` (satellites). The only **new** outbound is delivery: Telegram Bot API `POST https://api.telegram.org/bot<token>/sendMessage` (token from `TELEGRAM_BOT_TOKEN` env, never client-side). Optional AI summary uses Sampo's keyless **freellmapi.co** OpenAI-compatible endpoint (`model=auto`); if no AI key, fall back to a deterministic template digest.

**Rules model & engine (server).**
- ADD `lib/alerts/types.ts`: `AlertRule` = `{ id, name, kind: "geo-enter"|"camera-offline"|"count-threshold", target, params, quietHours?: {tz, from, to}, channel: "telegram"|"browser", enabled }`; `target` for geo = `{ bbox:[w,s,e,n], category?: PlaneCategory }`, for camera-offline = `{ cameraId, minutes }`, for count = `{ bbox, kind, gt }`.
- ADD `lib/alerts/engine.ts`: pure `evaluate(rules, prevSnapshot, nextSnapshot): AlertEvent[]`. Geo-enter = object in bbox now AND not in prev (edge-trigger, dedupe by object id); camera-offline = `available:false` (or `lastSampledAt` age) sustained `>= minutes`; count = current count in bbox `> gt`. Quiet-hours suppression and a per-rule cooldown live here. **Pure + unit-testable**, same discipline as `lib/planes/trail.ts`.
- ADD `lib/alerts/store.ts`: rule persistence. v1 = anonymous, no DB — rules live in `localStorage` and are POSTed to the cron evaluator as part of the digest subscription token (see Risks). Snapshot/prev-state for edge-triggers persisted in **Vercel KV** (keyless within Vercel free tier) keyed by rule id.

**Scheduler & delivery (server).**
- ADD `app/api/alerts/cron/route.ts` + a `vercel.json` cron entry (e.g. `*/5 * * * *`). Each tick: pull current snapshots via the existing registry/adsb/celestrak helpers, load active rules + prev snapshot from KV, run `engine.evaluate`, then dispatch.
- ADD `app/api/alerts/digest/route.ts`: separate cron (daily/`0 8 * * *`) that aggregates last-24h stats (busiest hour from per-tick counts in KV, top notable flights by category, offline-camera count), calls `lib/alerts/summarize.ts` (freellmapi or template), and sends one Telegram message (≤ 30 ranked items, deduped).
- ADD `lib/alerts/deliver.ts`: SSRF-safe outbound — only `api.telegram.org` host-allowlisted, `redirect:"error"`, `AbortSignal.timeout(8000)`, token from env. Mirrors the discipline in `lib/proxy/`. Browser channel = a stored event list polled by the client (`GET /api/alerts/events`) surfaced via the Notifications API.

**Client (UI).**
- ADD `components/AlertRulesPanel.tsx`: a slide-in editor reachable from the left layer rail and the Ctrl/Cmd-K palette ("New alert rule"). Drawing a bbox = reuse the map; click-drag a rectangle, store as `[w,s,e,n]`. Category dropdown is fed by `lib/planes/classify.ts` labels.
- ADD `lib/alerts/useAlerts.ts`: external store (same `useSyncExternalStore` pattern as `lib/overlay.ts`/`lib/layers.ts`) holding local rules + recent fired events; renders a small badge on the status bar.
- CHANGE `app/page.tsx`: mount `<AlertRulesPanel />`; CHANGE the layer rail / command-palette to expose "Alerts".

**UX / states.** Empty = "No rules yet — draw a box and pick a trigger". Creating = live preview of how many current objects match. Firing = toast + optional browser notification + Telegram. Quiet hours = greyed "muted until 07:00". Error (Telegram 401/timeout) = rule shows a `delivery failed` chip; never blocks the map. Keyboard: panel Tab-navigable; `Esc` closes; rule rows are buttons.

**SSRF/proxy.** Only delivery is cross-origin and it is host-allowlisted to `api.telegram.org` (+ the freellmapi base) exactly like the existing image/HLS proxies; the client still never receives a raw `streamUrl` and never holds the bot token.

## 5. Dependencies & prerequisites
- `data-freshness-ticker` (per-source `lib/sources/status.ts` / camera `available` + `lastSampledAt`) — the camera-offline trigger reuses its staleness signals.
- `left-layer-rail` and the command-palette shell (`dark-ops-console-shell`) — entry points for the rules panel.
- `flight-tracking` + `lib/planes/classify.ts` — category triggers (e.g. `military`).
- Libraries: `@vercel/kv` (free tier) for snapshot/cooldown state; no new client deps. Env: `TELEGRAM_BOT_TOKEN`, optional `FREELLM_API_KEY`/base.

## 6. Risks & mitigations
- **Vercel Cron min interval / stateless functions:** edge-triggers need prev-state — persist snapshots in KV, not in-process; accept ~5-min geo-enter granularity (documented).
- **Telegram rate limits (30 msg/s, per-chat throttling):** batch per-tick events into one message per chat; respect a per-rule cooldown in `engine.ts`.
- **Anonymous persistence:** no accounts in v1, so server-side rules need a token. Mitigation: rules live client-side; only *subscribed* digest/alert rules are registered server-side under a random opaque token the user copies — no PII, revocable.
- **Scale (3,300 cameras / hundreds of planes per tick):** evaluate only bbox-scoped rules (spatial prefilter on lat/lon before per-object checks); cap rules per token.
- **ToS / abuse:** Telegram + freellmapi only; allowlisted hosts; no scraping of new sources; digest respects the same attribution as the map.
- **Notification fatigue:** mandatory cooldown + quiet hours + dedupe by object id.

## 7. Acceptance criteria
- [ ] `lib/alerts/engine.ts` is pure and unit-tested: geo-enter edge-triggers once per object entry, camera-offline fires only after the sustained window, count fires on threshold crossing, quiet hours + cooldown suppress correctly.
- [ ] A user can draw a bbox, pick `military` aircraft, and receive a Telegram message when a matching contact enters (verified against a recorded fixture).
- [ ] A daily digest sends one Telegram message with busiest hour, notable flights, and offline-camera count, ≤ 30 deduped items, AI-summarized with deterministic fallback.
- [ ] Delivery is host-allowlisted to `api.telegram.org` (+ freellmapi); bot token only server-side; client never receives a `streamUrl` or token.
- [ ] Rules persist across reloads (localStorage); server state in KV; no signup required.
- [ ] Feature is fully optional — disabling/not configuring `TELEGRAM_BOT_TOKEN` leaves the map untouched; build + existing tests pass.

## 8. Out of scope / future
Accounts/auth, AES-256 encrypted channels, Slack/Discord/Email/webhook channels, maritime-vessel triggers (pending the `maritime-ais-vessels` adapter), satellite-pass alerts, sub-minute alerting, mobile push beyond the browser Notifications API, and a full alert-history dashboard. Defer all until the core console and at least one external channel prove valuable.
