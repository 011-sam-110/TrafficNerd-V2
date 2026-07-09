# World Monitor — improvement roadmap (/goal)

Derived 2026-07-08 from a 4-persona verified product review (Investor, Journalist,
Gov/Defense/NGO, Tech/Finance). Each milestone is one gated, committed checkpoint.

## Build gate
- Gate: `npx tsc --noEmit && npm test`  (full: `npm run build`)
- UI evidence: Playwright screenshots to `persona-shots/`
- Commit: one commit per milestone, `M<n>: <name>`, solo attribution (repo convention)
- PR: fresh branch + PR per milestone group (Sampo live-merges + deletes branches fast)

Status keys: `[ ]` todo · `[~]` in progress · `[x] done (date, commit)` · `[!] blocked: <reason>`

Branch: `feat/goal-improvements` (M0–M8). Baseline was 527 tests; now 539.

---

### M0: Old code → PRs + repo hygiene
Status: [x] done (2026-07-08, branches pushed)
- [x] `feat/widget-width-resize` pushed (8 unpushed `main` commits) — open: /compare/main...feat/widget-width-resize
- [x] `feat/variant-spine` pushed as triage branch (older SP2 "widgetize", 2.8k lines, diverged)
- [x] `.next-dev/` git-ignored; 4 stale merged worktrees (tn-source-widgets/tn-sp1b/tn-sp6/tn-widgets) reported

### M1: Rebrand TrafficNerd → World Monitor
Status: [x] done (2026-07-08, 99a1c55) — verified: wordmark "World Monitor" + tab title live
Spec: Gov C6.

### M2: Fly-to-anywhere (place search)
Status: [x] done (2026-07-08, 3959d56) — verified: ⌘K "Kyiv" → geocoded fly-to results
Spec: Gov M7. Approach: wired the keyless Photon geocoder into the ⌘K palette (no floating-bar
collision with the breaking banner) rather than mounting the standalone PlaceSearch component.

### M3: Rename "Watchlist" → "Saved places"
Status: [x] done (2026-07-08, 984f54b)
Spec: Investor C5 / Gov C2 / TechFin C4. Used the app's existing "Saved places" i18n term for consistency.

### M4: Dormant layers show "locked — needs key"
Status: [~] partial — Markets dormant sections now shown with a 🔒 "needs key" note (were hidden).
Remaining: per-signal-layer "locked" badges (needs a small /api/status route reporting configured env). Deferred.
Spec: Journalist M8 / Gov C10.

### M5: Real markets (commodities + live equities)
Status: [x] done (2026-07-08, f007132) — VERIFIED LIVE: Brent/WTI/NatGas/Gold/Silver/Wheat + SPY/QQQ/AAPL/NVDA
Spec: all personas. Keyless via Yahoo v8 chart (Finnhub still used when keyed). Console widget stops hiding
dormant sections. Event→asset "impact strip" (banner↔price link) NOT built — deferred (commodities now
surface the move + the ≥5% mover alert covers the core need).

### M6: Persisted history + sparklines
Status: [x] done (2026-07-08, 4de1aad) — persisted `lib/series.ts` + `<Sparkline>` on market rows
Spec: all personas. Note: sparklines accumulate over polls (need ≥2 samples), so a fresh load shows none —
they build up and survive reload. Instability-metric sparkline deferred.

### M7: Timeline playback (scrubber)
Status: [ ] — needs a historical signal/event snapshot pipeline (persist map state over time), a genuine
new subsystem, not a quick add. Deferred with intent, not stubbed.
Spec: Journalist C2 / Gov M1.

### M8: CSV/GeoJSON export per widget + dossier
Status: [x] done (2026-07-08, <this branch>) — VERIFIED: "⬇ Export CSV" in the Markets widget menu
Spec: all personas. Pure `toCsv`/`toGeoJson`/`downloadText` (tested) + generic WidgetFrame export menu
(any widget opts in by reporting `export`). Wired: Markets (CSV), Events (CSV+GeoJSON), dossier (GeoJSON/CSV).
Other widgets opt in with one line each — follow-up.

### M9: Honest camera coverage + fix TfL HLS 403
Status: [ ] todo
Spec: Journalist C5 / Gov C9.

### M10: i18n uk/ru/ar + RTL
Status: [ ] todo — large (full locale translation + RTL)
Spec: Gov M8.

### M11: Consolidate organizing systems
Status: [!] blocked: needs Sampo's decision on which system is canonical (variants vs presets)
Spec: Investor C10 / Journalist C7.

---

## Second review (2026-07-09) — 5-persona ingestibility + data-gap pass

Derived from a blind 5-critic design review (OSINT analyst, emergency responder, competitor PM,
information-design pro, mobile power-user). Consensus ~2/5: strong bones, but the product *looks*
emptier/more broken than it is. Top cross-cutting fixes below, ordered by impact-per-effort.

### M12: Persona → map-layer sync
Status: [x] done (2026-07-09, <this branch>) — VERIFIED: Emergency board globe now shows quakes/fires/
GDACS hazards (planes+cameras OFF); analyst default board opens with `— cam / 0 planes / 0 sat`.
Screenshots: persona-shots/m12_intelligence_default.png, persona-shots/m12_emergency_hazards.png.
Spec: 2nd-review finding #1 (flagged by 4/5 critics — the top issue).
Problem: `applyPreset()` only swaps the widget cards (`shellLayoutStore.replace`), never the map's
layer stores (`lib/layers.ts` core + `lib/signals/store.ts`), so every persona shows the same
default planes+cameras globe. An emergency responder is shown airline traffic, not hazards.
Approach: a PURE `layersForLayout(layout)` (widget type → map layer) in `lib/console/presetLayers.ts`,
applied by `applyPreset` via `layersStore.applyExact` + `signalsStore.applyExact`. `signal:<id>`→that
signal ON; cameras/aviation/satellites widget→that core layer ON; every other core layer OFF; the
`countries` base layer always stays ON. Also fixes the default-board case (analyst board no longer
opens on planes) since first-run seeds via the same `applyPreset`.
Acceptance:
- [ ] `layersForLayout` unit-tested: Intelligence → {instability,conflict,acled,protests,military-air} signals ON, all core off; Aviation → planes+cameras core ON + {gpsJamming,military-air,airports} signals.
- [ ] Every built-in persona yields ≥1 ON map layer (regression guard against a persona with a blank map).
- [ ] Applying Emergency Response turns planes/cameras OFF and hazard layers ON on the globe (screenshot before/after).
- [ ] Gate green: `npx tsc --noEmit && npm test`.

### M13: Honest empty & freshness states
Status: [ ] todo
Spec: 2nd-review finding #2 (flagged 5/5) + freshness (3/5).
Also fold in a bug M12 surfaced: the GDACS feed carries duplicate event ids → React "two children
with the same key" warning (×many) in the Disaster-alerts list. Dedupe by id in `lib/signals/gdacs.ts`
(or use a composite row key in `signals.tsx`).
Three distinct empty states instead of one grey "Nothing in World.": genuinely-quiet ("No active
conflicts · checked 2m ago ✔"), feed-failed ("Feed unavailable — retrying"), dormant/keyed ("ACLED
not connected — needs credentials"). Widget header chip shows last-successful-fetch age + a status
dot, not the poll cadence. (ACLED provisioning itself → Needs from Sampo.)

### M14: Mobile map-first layout + palette FAB
Status: [ ] todo
Spec: 2nd-review finding #3 (2 BLOCKERs from the mobile critic).
At ≤768px the fixed-width `.tn-cw-*` columns crush the map to ~0px and ⌘K (only nav) is display:none
on touch. Re-point the orphaned mobile CSS (currently targets old `.tn-rail`/`.tn-dossier`) at
`.tn-cw-*`: full-bleed map + widgets in a swipe-up bottom sheet, plus a thumb-reachable palette FAB.

### M15: Scannable list rows + severity ramp + map legend
Status: [ ] todo
Spec: 2nd-review finding #4 + ingestibility quick-wins (4/5).
One row grammar across every list widget: `[severity/magnitude, colour-ramped, dominant] · [name] ·
[age, muted, right]`. Drop the leaked "2.8" instability prefix; decode military-flight rows to
altitude + country. One severity colour ramp (grey→amber→red) reserved for magnitude only. A
persistent map legend keyed to the active layers (the 984/161 clusters + yellow markers are unlabelled).

### M16: Country dossier "Active events" + mount daily digest
Status: [ ] todo
Spec: 2nd-review finding #5 + competitor #8 / mobile #3.
Fill the dossier's "Active events" (COMING SOON) by spatially filtering loaded signal features to the
country polygon (data is one bbox-test away). Mount the already-built-but-orphaned `DailyBrief`/
`TopEventsPanel` as a "top 5 right now" digest strip for the 15-second glance.

### M17: Close the data gaps (enrichment)
Status: [ ] todo
Spec: 2nd-review missing-data table.
NASA FIRMS global wildfires + FRP (EONET fires are US-only); surface USGS PAGER alert / depth /
tsunami (already fetched, discarded); global cyclone basins (JTWC/GDACS-TC — NHC is Atlantic-only,
contradicts the BAVI-26 alert); real flood source (GDACS FL / Copernicus / GloFAS); add dormant
ReliefWeb to the Emergency board. One adapter + one registry entry + one fixture test each.

### M18: User-defined alerts / watchlist rules (moat)
Status: [ ] todo
Spec: competitor #4 (pairs with M7 replay).
Turn "Saved places" (bookmarks) into persisted alert rules (geofence / threshold / new-event-near-X)
that fire a browser/Push notification — the feature that separates a paid tool from a live curiosity.

---

## Needs from Sampo
- Open the two old-code PRs (gh token here can't create PRs):
  - /compare/main...feat/widget-width-resize (ready)
  - /compare/main...feat/variant-spine (triage — older SP2 work)
- API keys for premium layers (Vercel env) — all have keyless fallbacks now, keys only upgrade quality:
  `FINNHUB_API_KEY`, `FRED_API_KEY` (unlocks live rates/VIX — the one still-dormant markets section),
  `ACLED_EMAIL`/`ACLED_PASSWORD`, `ENTSOE_API_TOKEN`, `AISSTREAM_API_KEY`, `FREELLMAPI_*`.
- M11: confirm the canonical organizing system before any removal.

## Build log
- M0 (9ea6c05) roadmap + build gate + repo hygiene; pushed 2 old-code branches.
- M1 (99a1c55) rebrand → World Monitor. verified live.
- M2 (3959d56) ⌘K geocoder fly-to-anywhere. verified: Kyiv.
- M3 (984f54b) Watchlist → Saved places.
- M5 (f007132) real markets: keyless commodities + equities (Yahoo). verified: Brent/WTI/Gold live.
- M6 (4de1aad) persisted series + market-row sparklines.
- M8 CSV/GeoJSON export: serializers + WidgetFrame menu + Markets/Events/dossier. verified: Export CSV in menu.
- M12 persona→map-layer sync: pure layersForLayout() + applyPreset drives layersStore/signalsStore.
  verified live: Emergency board renders hazards not planes; analyst default no longer plane-swarmed. +4 tests (631 total).
