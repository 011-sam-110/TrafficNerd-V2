# PRD: Breaking-alert banner (multi-source corroboration)
> Priority: P2 · Effort: M · Status: Proposed · Category: alerting

## 1. Summary
An auto-firing **breaking banner** that drops from the top of the dark ops console only when a transport event is **corroborated by two or more independent signals** we already compute (aircraft emergency squawks, ADS-B route-disruption, regional camera-outage spikes, satellite decay). Each candidate alert is scored, **deduplicated by a stable event key**, and **rate-limited** so the banner never spams. Outcome: a high-signal "something is actually happening" cue that turns thousands of silent dots into a single trustworthy headline — with zero new keys.

## 2. Why it matters for TrafficNerd
A dense globe of ~3,300 cameras + hundreds of planes + satellites hides the one thing that matters: the incident in progress. A lone plane squawking 7700 is a dot; a 7700 squawk **plus** that flight's route to LHR going dark **plus** a cluster of London JamCams freezing is a story. Corroboration is exactly the discipline that keeps a free, keyless, portfolio-grade console from crying wolf — it demonstrates real signal engineering, not a toy notification.

## 3. worldmonitor.app reference
worldmonitor fires its breaking banner only on corroboration across ~5 independent origins (news classification, keyword velocity, hotspot escalation, military surges, official sirens), then deduplicates and rate-limits so it doesn't flood. We adapt the **pattern** (N-of-M independent corroboration → dedup → rate-limit → single banner), mapped onto our transport signals — not its news/military sources.

## 4. How we build it (TrafficNerd-specific)

**Signals (all derived from data already in-process — no new outbound hosts):**
- **EMERGENCY_SQUAWK** — from `lib/sources/adsb.ts`: extract `squawk` (`7700` general / `7600` radio-fail / `7500` hijack) and the `emergency` field into plane `meta`. One squawking aircraft = one signal.
- **ROUTE_DISRUPTION** — a tracked plane (via existing adsbdb route lookup) whose breadcrumb in `lib/planes/trail.ts` shows a sustained descent/hold or drops off-feed near its destination airport.
- **CAMERA_OUTAGE** — from `lib/sources/status.ts` (the freshness store): a region where the `stale`/`down` count crosses a threshold within one TTL window (regional CCTV blackout).
- **SAT_DECAY** — from `lib/satellites/propagate.ts`: a tracked object whose propagated perigee falls below a reentry threshold.

**Correlation engine (server, evaluated per registry/poll cycle):**
- ADD `lib/alerts/signals.ts` — each detector returns `Signal[]` `{ kind, key, lat, lon, region, at, weight }`.
- ADD `lib/alerts/correlate.ts` — spatially/temporally bins signals (geohash bucket + 10-min window); emits an `Alert` only when **≥2 distinct signal kinds** share a bucket OR a single critical kind (7700/7500) fires. Stable `eventKey = hash(kind-set + bucket)` for dedup.
- ADD `lib/alerts/ratelimit.ts` — suppresses a repeat `eventKey` for a cooldown (e.g. 15 min); caps to N concurrent active alerts.
- ADD `app/api/alerts/route.ts` (`force-dynamic`) — `Response.json({ at, alerts })`; severity/label/lat/lon/contributing-kinds only. **Never** a raw `streamUrl` or outbound URL.

**Client:**
- ADD `lib/alerts/useAlerts.ts` — external store (same `useSyncExternalStore` pattern as `lib/overlay.ts`/`lib/layers.ts`) polling `GET /api/alerts` every ~20s; dedups by `eventKey`; tracks dismissed ids.
- ADD `components/BreakingBanner.tsx` — top slide-down bar (above the status metrics bar), severity color, monospaced count of corroborating signals, "FLY TO" action that calls the existing globe `flyTo(lat,lon)` and opens the dossier (`overlay.open`).
- CHANGE `app/page.tsx` — mount `<BreakingBanner />`; register a Ctrl/Cmd-K command "Jump to active alert".
- CHANGE `lib/sources/adsb.ts` — surface `squawk`/`emergency` (small, also useful in `PlaneDetail.tsx`).

**UX/states:** No alerts → banner unmounted (zero footprint). New alert → slide-down + subtle pulse; multiple → "1 of 3" stepper. Loading/error of `/api/alerts` → silent (never show a fake alert). Each alert is **dismissable** (X / Esc) and auto-expires when its signals clear. Keyboard: Esc dismisses focused alert; arrow keys step the stepper.

**SSRF/proxy:** none added — the engine reads only in-process signals; the client receives labels/coords/severity, never a stream URL.

## 5. Dependencies & prerequisites
- `data-freshness-ticker` (slug) — provides `lib/sources/status.ts` that CAMERA_OUTAGE consumes.
- `flight-tracking` + `satellite-orbit-tracking` (slugs) — provide squawk/route data and propagation.
- `unified-globe-flat-map-engine` (slug) — provides `flyTo`; `dark-ops-console-shell` provides the top-bar slot and command palette.

## 6. Risks & mitigations
- **False positives:** require ≥2 independent kinds (except critical squawks); tune weights/cooldown in `lib/alerts/correlate.ts`.
- **Vercel statelessness:** rate-limit/cooldown state resets on cold start → re-fire risk; persist `eventKey` cooldowns client-side in the store and cap server emits per response.
- **Performance:** detectors run over already-fetched arrays (no per-camera loop on the hot path); correlation is O(signals), bounded by binning.
- **No new ToS/rate-limit exposure:** zero new outbound calls.

## 7. Acceptance criteria
- [ ] `GET /api/alerts` returns only corroborated alerts (≥2 kinds, or a critical squawk) with `severity`, `label`, `lat/lon`, `contributingKinds` — and never a URL/stream URL.
- [ ] A single 7700 squawk in fixtures fires exactly one banner; a non-critical lone signal fires none.
- [ ] Repeat of the same `eventKey` within cooldown does not re-fire.
- [ ] Banner slide-down renders, "FLY TO" flies the globe + opens the dossier, Esc dismisses, multi-alert stepper works.
- [ ] SSRF allowlist unchanged; build + unit tests (correlate/dedup/ratelimit) pass.

## 8. Out of scope / future
Maritime/AIS signals (until that layer lands), push/email/webhook delivery, sound, historical alert log/replay, ML event classification, and cross-region "surge" heuristics. Defer until the core layers are live.
