# World Monitor — improvement roadmap (/goal)

Derived 2026-07-08 from a 4-persona verified product review (Investor, Journalist,
Gov/Defense/NGO, Tech/Finance). Each milestone is one gated, committed checkpoint.

## Build gate
- Gate: `npx tsc --noEmit && npm test`  (full: `npm run build`)
- UI evidence: Playwright screenshots to `persona-shots/`
- Commit: one commit per milestone, `M<n>: <name>`, solo attribution (repo convention)
- PR: fresh branch + PR per milestone group (Sampo live-merges + deletes branches fast)

Status keys: `[ ]` todo · `[~]` in progress · `[x] done (date, commit)` · `[!] blocked: <reason>`

---

### M0: Old code → PRs + repo hygiene
Status: [x] done (2026-07-08, branches pushed)
Depends on: —
Spec: Capture stranded/unpushed work in PRs; ignore build output.
Acceptance:
- [x] `feat/widget-width-resize` pushed (8 unpushed `main` commits) — PR: /compare/main...feat/widget-width-resize (gh token can't open PRs; Sampo clicks)
- [x] `feat/variant-spine` pushed as triage branch (older SP2 "widgetize" work, 2.8k lines, diverged — Sampo decides)
- [x] `.next-dev/` git-ignored; 4 stale merged worktrees (tn-source-widgets/tn-sp1b/tn-sp6/tn-widgets) reported for cleanup

### M1: Rebrand TrafficNerd → World Monitor
Status: [ ]
Depends on: —
Spec: Gov C6 — every on-screen identity still says "TrafficNerd".
Acceptance:
- [ ] `<title>`, `applicationName`, `appleWebApp.title`, manifest `name`/`short_name` = "World Monitor"
- [ ] Header wordmark (StatusBar) renders "World Monitor"
- [ ] Description reflects the global-monitor product (not "traffic cameras")
- [ ] Gate green; screenshot shows the new wordmark + tab title

### M2: Mount place search (fly-to-anywhere)
Status: [ ]
Depends on: —
Spec: Gov M7 — `PlaceSearch`/geocoder exist but are unmounted dead code; you cannot fly to Kyiv/Gaza.
Acceptance:
- [ ] `PlaceSearch` mounted in the shell; `/api/geocode` (Photon) reachable
- [ ] Typing "Kyiv" flies the map there (screenshot)
- [ ] Gate green

### M3: Rename "Watchlist" → "Saved views"
Status: [ ]
Depends on: —
Spec: Investor C5 / Gov C2 / TechFin C4 — "Watchlist" is map bookmarks, not an entity/ticker watch; the name misleads.
Acceptance:
- [ ] Panel title + registry + i18n strings say "Saved views" (not "Watchlist")
- [ ] Behaviour unchanged; gate green

### M4: Dormant layers show "locked — needs key" (not hidden)
Status: [ ]
Depends on: —
Spec: Journalist M8 / Gov C10 — key-gated layers return empty silently, indistinguishable from "quiet".
Acceptance:
- [ ] Signals rail / catalog marks key-gated sources as "locked — needs key" with the env var name
- [ ] Markets dormant sections already labelled — verified consistent
- [ ] Gate green; screenshot

### M5: Real markets (commodities + live equities + always-render + event→asset)
Status: [ ]
Depends on: —
Spec: All personas — Markets is crypto+FX only; no commodities; equities/rates dormant.
Acceptance:
- [ ] `/api/markets` gains a keyless **commodities** section (Brent/WTI/NatGas/Gold via Stooq) with a pure parser + unit test
- [ ] A keyless **equities/index** fallback (Stooq) renders SPY/QQQ/etc live without a key (Finnhub still used if keyed)
- [ ] Console Markets widget stops hiding dormant sections (shows "needs key" placeholder)
- [ ] Event→asset "impact" cue: BREAKING energy/oil events surface the commodities row
- [ ] Gate green; screenshot of commodities live

### M6: Persisted history + sparklines
Status: [ ]
Depends on: M5
Spec: All personas — everything is a live snapshot; no trend.
Acceptance:
- [ ] A persisted (IndexedDB/localStorage) time-series buffer records each markets/instability poll (pure store + tests)
- [ ] Sparklines render on market rows and the instability metric from the persisted buffer
- [ ] Survives reload; gate green; screenshot

### M7: Timeline playback (scrubber)
Status: [ ]
Depends on: M6
Spec: Journalist C2 / Gov M1 — no way to rewind an evolving situation.
Acceptance:
- [ ] A time scrubber replays the recorded signal/event history on the map (pure timeline logic + tests)
- [ ] Play/pause + step; honest empty-state when no history yet
- [ ] Gate green; screenshot

### M8: CSV/GeoJSON export per widget + dossier
Status: [ ]
Depends on: —
Spec: All personas — data is trapped on screen.
Acceptance:
- [ ] Pure `toCsv` / `toGeoJson` serializers with unit tests
- [ ] Every widget frame + signal/country dossier has an Export (CSV / GeoJSON) action with source + UTC baked in
- [ ] Gate green; screenshot of a downloaded file's contents

### M9: Honest camera coverage + fix TfL HLS 403
Status: [ ]
Depends on: —
Spec: Journalist C5 / Gov C9 — cameras are Western-only (silent gaps) and some TfL HLS streams 403.
Acceptance:
- [ ] Coverage is stated (covered networks/regions listed; uncovered regions not implied "quiet")
- [ ] TfL HLS 403 root-caused and fixed or gracefully degraded to still image with a clear note
- [ ] Gate green

### M10: i18n uk/ru/ar + RTL
Status: [ ]
Depends on: —
Spec: Gov M8 — EN/ES/FR only; NGO field partners need uk/ru/ar.
Acceptance:
- [ ] `uk`, `ru`, `ar` locales added to the i18n catalog; LangSwitcher lists them
- [ ] Arabic sets `dir="rtl"`; layout survives RTL (screenshot)
- [ ] Gate green

### M11: Consolidate organizing systems
Status: [ ]
Depends on: —
Spec: Investor C10 / Journalist C7 — variants vs field-presets vs Cmd-K presets overlap confusingly.
Acceptance:
- [ ] Cmd-K previews which layers/widgets each variant/preset enables (or the systems are unified)
- [ ] One obvious path each to "conflict" and "markets"; gate green

---

## Needs from Sampo
- API keys for premium dormant layers (add to Vercel env): `FINNHUB_API_KEY`, `FRED_API_KEY`, `ACLED_EMAIL`/`ACLED_PASSWORD`, `ENTSOE_API_TOKEN`, `AISSTREAM_API_KEY`, `FREELLMAPI_BASE_URL`/`FREELLMAPI_KEY` — M4/M5 ship keyless fallbacks; keys upgrade quality.
- M11: confirm which organizing system is canonical (variants vs presets) before any removal.

## Build log
- (entries appended per milestone)
