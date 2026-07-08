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
