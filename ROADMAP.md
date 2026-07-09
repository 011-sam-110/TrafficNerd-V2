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

## Third review (2026-07-09) — owner directive: "not fullscreen, widgets terrible, no charts, want data depth, be as good as theirs"

4-agent deep pass (immersive-layout / widget-dataviz / data-depth / competitive-benchmark). Benchmark
identified: **ShadowBroker**-class OSINT dashboards (~40 layers/60+ sources). Competitors win on 4 axes
in order: (a) time/playback, (b) compositing (opacity/legend/density), (c) entity depth, (d) alerting.
World Monitor already leads on layer breadth — the gap is the interaction layer + presentation.
M13–M14 below are re-scoped from those agent specs and jump the queue.

### M13: Kill widget/bottom dead-space + density pass
Status: [x] done (2026-07-09, <this branch>) — VERIFIED at 1920×1080: empty widgets collapse to ~90px
(were fixed 260px); the empty bottom dock shrank from ~225px to ~95px so the map gained ~125px of
height. Screenshots: persona-shots/m13_intelligence_default.png, persona-shots/m13_emergency_nodeadspace.png.
Spec: 3rd-review agent A ship-order 1,2,4. `WidgetFrame` height→maxHeight + `.tn-cw-body` flex:1→1 1 auto
(content-height frames); bottom dock only renders when it has widgets + maxHeight cap + hug-content;
density (segment 320→300, bottom 240→220, gap/pad 8→10, radius 8→10). Preserved ⌘K, grips, share, M12.
Acceptance: [x] no empty widget exceeds ~90px · [x] empty bottom reclaims map height · [x] gate green.

### M19: Full-bleed floating-panel map (the true immersive look)
Status: [x] done (2026-07-09, <this branch>) — VERIFIED at 1920×1080: the map fills the whole viewport
edge-to-edge and the three segments float over it as translucent glass panels (Windy/ShadowBroker feel).
Screenshot: persona-shots/m19_fullbleed_final.png.
Spec: 3rd-review agent A ship-order 3. `.tn-cw-shell` map is now `position:absolute; inset:0` (z0) with
the segments as absolute overlay columns (z15); segment track transparent; cards pinned light glass
(rgba(255,255,255,.9) + backdrop-blur — not var(--tn-surface), which would break dark-theme ink). Grips
became absolute `tn-grip-l/-r/-b` handles positioned off `--tn-lw/--tn-rw/--tn-bh`; MapLibre zoom +
attribution lifted off the panels via the same vars. ⌘K, resize, share URLs, M12/M13/M14 all intact.

### M14: Widget data-viz — MetricBar + severity dots
Status: [x] done (2026-07-09, <this branch>) — VERIFIED live: Earthquakes rows now carry a proportional
lime→red magnitude bar; GDACS Disaster-alerts + Wildfires rows carry a Green/Orange/Red severity dot;
the leaked grey magnitude number is gone. GDACS dedupe dropped console errors 64→0.
Screenshot: persona-shots/m14_emergency_metricbars.png.
Spec: 3rd-review agent B. `projectSignal()` dropped `feature.color` (already severity-ramped) so every
row was a grey number. Added a declared per-source `metric` descriptor (`SignalMetric` in types.ts) +
a pure `rowMetric()`, threaded `color`+`metric` through `SignalRow`, built `<MetricBar>` and wired the
generic `signals.tsx` row (bar when a source declares a metric — earthquakes/EMSC/instability — else a
severity-coloured dot from `feature.color`). Honest: no bar where a source declares no real scalar
(GDACS/fires get a dot, not the fake radius proxy). +6 tests. Also deduped GDACS by id (the M12 key bug).
Follow-ups (M14b, deferred): SeverityChip variant for GDACS (glyph+RED/ORANGE pill), Earthquakes depth
in the meta line, the Instability leaderboard hero (ranked score bars + weighted factor breakdown).

### M15: Data depth — surface dropped upstream fields
Status: [ ] todo
Spec: 3rd-review agent C. Fields already fetched but discarded before the UI. Do-first five:
GDACS `alertscore`+numeric severity; USGS PAGER `alert`+`tsunami`+`sig`/`felt`/`mmi`+`depth`;
military ADS-B vertical-rate + squawk-decode (7500/7600/7700) + `emergency`; GDELT DOC tone+Goldstein
+GKG themes (turns "N articles" into escalation/sentiment); instability raw factor values + vintage.
Then AIS ShipStaticData (type/dest/flag), INFORM risk index. One adapter+entry+fixture per new source.

### M16: Map legend + per-layer opacity/compositing
Status: [ ] todo
Spec: 3rd-review agent D #2/#3. Persistent on-map legend keyed to active layers (984/161 clusters +
yellow markers are unlabelled); a per-layer opacity slider + stacking; density/heatmap mode for
high-count layers. Opacity is currently hardcoded in `WorldMap.tsx` paint.

### M17: Global timeline scrubber / playback
Status: [ ] todo
Spec: 3rd-review agent D #1 (the single biggest "live map vs toy" differentiator; supersedes old M7).
Bottom timeline with play/pause + variable speed + drag-to-time, re-feeding the map's aggregated
source at time T. The widget-history spine (`lib/widgets/history.ts`) already persists samples.

### M18: Honest empty/freshness + mobile map-first + alerting
Status: [ ] todo
Spec: folds the earlier 2nd-review M13/M14/M18 — three distinct empty states + real "updated Xm ago"
freshness; ≤768px map-first bottom-sheet layout + palette FAB; user-defined geofence/threshold alert
rules → browser/webhook notification (the feature that makes it a monitoring product, not a curiosity).
Three distinct empty states instead of one grey "Nothing in World.": genuinely-quiet ("No active
conflicts · checked 2m ago ✔"), feed-failed ("Feed unavailable — retrying"), dormant/keyed ("ACLED
not connected — needs credentials"). Widget header chip shows last-successful-fetch age + a status
dot, not the poll cadence. Country dossier "Active events" (spatial filter, data one bbox away) +
mount the orphaned `DailyBrief`/`TopEventsPanel` digest. (ACLED provisioning → Needs from Sampo.)

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
- M13 dead-space + density: WidgetFrame maxHeight + content-height body; bottom dock collapse-when-empty/hug-content;
  segment 300/220 + gap/pad 10. verified 1920×1080: empty widgets ~90px, map +125px. 631 tests green.
- M14 widget data-viz: SignalMetric descriptor + pure rowMetric() + <MetricBar> + severity dots wired into the
  generic signal row; earthquakes/EMSC/instability get bars, all else a colour dot. GDACS dedupe (errors 64→0). 637 tests.
- M19 full-bleed immersive map: map is now the 100% base layer; segments float over it as glass panels; absolute
  grips + lifted MapLibre controls off --tn-lw/--tn-rw/--tn-bh. verified 1920×1080. 637 tests green.
