# CLAUDE.md — World Monitor (TrafficNerd-V2)

A Next.js 15 single-page global situational-awareness map. Live: traffic-nerd-v2.vercel.app
(prod domain worldmonitor.app). Deployed product = `origin/main`.

## Build gate
- Roadmap: `ROADMAP.md` (driven by the `/goal` milestone loop — one gated milestone per invocation)
- Gate: `npx tsc --noEmit && npm test`   (full check: `npm run build`)
- UI evidence: Playwright screenshots to `persona-shots/`
- Commit: one commit per milestone, `M<n>: <name>`, **solo attribution** (matches every existing commit — no co-author trailer)
- PR: fresh branch + PR per milestone/group. Sampo live-merges and deletes branches fast → always branch off the latest `main` and open a new PR for follow-ons.

## Shape
- `app/` — routes + API. `app/api/*` are internal Next handlers (no user auth): cameras, planes, satellites, signals/[id], markets, news, brief, geocode, near, proxy, hls, geolocate.
- `components/WorldMap.tsx` — the single MapLibre globe→2D instance; all layers are data-driven.
- `components/shell/*` — thin console chrome (StatusBar, CommandPalette, BreakingBanner, panels).
- `components/console/*` — the widget workspace (segments + centre stage + resizable widget frames).
- `lib/signals/*` — one adapter + one `registry.ts` entry per global-signal layer (fetch() → [] on any failure).
- `lib/console/*` — widget registry, presets, store, share (`?c=` layout URL).
- `lib/variants/*` — the top-left "variant" switcher (13 built-in monitor profiles).
- `lib/i18n/*` — EN/ES/FR catalog + store.

## Conventions
- Adding a signal layer = one adapter file + one `SIGNALS` entry + a fixture unit test. No edits to WorldMap/route/dossier/rail (all data-driven).
- Every upstream fetch is keyless-first and **dormant-safe**: failures resolve to `[]` / last-good / a labelled placeholder, never a 5xx, never fabricated data.
- Keep the upstream→domain mapping in a PURE exported function with a unit test.
- Calm light identity; `.tn-*` CSS tokens in `app/globals.css`.

## State of play
See `ROADMAP.md`. Post-review (2026-07-08) build in progress: rebrand, place-search mount, saved-views
rename, real markets, persisted history/sparklines/playback, CSV/GeoJSON export, coverage honesty, i18n.
