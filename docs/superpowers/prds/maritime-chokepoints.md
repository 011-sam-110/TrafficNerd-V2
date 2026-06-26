# PRD: Maritime chokepoint monitor
> Priority: P2 · Effort: M · Status: Proposed · Category: data-layer

## 1. Summary
A "Corridors" panel that watches the world's strategic shipping chokepoints (Bab el-Mandeb, Hormuz, Suez, Panama, Malacca, Dover, Gibraltar, Bosphorus…) and scores each for live throughput and disruption. Rather than a new data feed, it is a **derived analytic layer** that counts AIS vessels (from the `maritime-ais-vessels` feature) inside fixed geofences, compares the live count to a rolling baseline, and flags anomalies. The panel header reads e.g. `2 of 13 corridors disrupted`; each chokepoint renders as a labelled polygon + badge on the same MapLibre globe, and clicking one opens a dossier with live transit count, trend, and disruption reason.

## 2. Why it matters for TrafficNerd
TrafficNerd already plots *individual* moving things; this is the first feature that turns raw positions into **insight about a corridor** — the "is this artery flowing or jammed?" question that makes an ops console feel intelligent. It directly delivers the `trafficnerdAngle`: a transport-corridor twist showing live throughput and anomaly flags vs a baseline. It is also architecturally reusable — the same geofence-count-and-score engine can later power busiest-airspace sectors (from the planes layer) and major rail/road arteries, so it earns its keep as a pattern, not a one-off.

## 3. worldmonitor.app reference
worldmonitor tracks 13 maritime chokepoints with live AIS counts, week-over-week transit change, a disruption score, density-anomaly flagging, and a header summary like "3 of 13 disrupted". We emulate the *presentation and scoring concept* but compute it entirely from our own keyless AIS-derived counts and a self-built baseline (worldmonitor's underlying paid AIS aggregation is not reused).

## 4. How we build it (TrafficNerd-specific)

### Data source (keyless)
No new upstream feed. This consumes the `WorldObject[]` of `kind:"ship"` produced server-side by `lib/sources/ais.ts` (Digitraffic Marine AIS, keyless). Because that source is currently Baltic-coverage, chokepoints outside coverage render as "no data" — honest, and zero refactor when more keyless AIS feeds are added. A static geometry file (no fetch) defines the 13 chokepoint polygons and centroids.

### Files to ADD
- `lib/corridors/chokepoints.ts` — static `CHOKEPOINTS: Chokepoint[]` (`id`, `name`, `centroid`, GeoJSON `polygon`, `lane` direction). Hand-authored bounding polygons.
- `lib/corridors/score.ts` — pure functions: `countInPolygon(ships, polygon)` (ray-cast point-in-polygon), `disruptionScore(live, baseline)` → `{ score: 0..1, deltaPct, state: "flowing"|"elevated"|"disrupted"|"nodata" }`. Unit-tested with fixtures.
- `lib/corridors/baseline.ts` — rolling baseline: server keeps an in-process ring buffer (last N samples per chokepoint) and a 7-day median persisted to a small JSON cache; `weekOverWeek(live, baseline)`. No DB.
- `app/api/corridors/route.ts` — `export const dynamic = "force-dynamic"`; `GET` reads the already-cached ships, runs counts + scores, returns `{ summary: { disrupted, total }, corridors: CorridorStatus[] }`; never throws.
- `lib/corridors/useCorridors.ts` — client store (mirrors `lib/planes/usePlanes.ts`) polling `/api/corridors` every ~30s, keep-last-good on error, via `useSyncExternalStore`.
- `components/CorridorPanel.tsx` — the left/right ops panel: header summary + sortable rows (name · count · Δ% sparkbar · state pill).
- `components/CorridorDetail.tsx` — dossier for a clicked chokepoint.
- `lib/corridors/score.test.ts` — point-in-polygon + scoring band assertions.

### Files to CHANGE
- `lib/layers.ts` — add `"corridors"` to `LayerKey`/`LayerState` (default `true`); rail shows the `disrupted/total` count.
- `components/MapView.tsx` / `components/GlobeView.tsx` — add a MapLibre GeoJSON `source` (`corridors`) with a `fill` layer (`fill-color` via `match`/`step` on `state`: flowing `#2dd4bf`, elevated `#fbbf24`, disrupted `#f43f5e`, nodata `#475569` at low opacity), a `line` outline, and a `symbol` label layer (`text-field` = name + count). Zoom-gated so polygons fade in past the globe view.
- `app/page.tsx` — mount `<CorridorPanel>` in the existing right dossier / left rail shell.
- Command palette — add a "Toggle Corridors" action and "Jump to disrupted corridor".

### UX
Default on. Panel header: `N of 13 corridors disrupted` (red when N>0). Each row: name, live count (monospaced), Δ% vs week baseline (up/down arrow), and a coloured state pill; click a row or its map polygon → right dossier (live count, 7-day median, Δ%, density-anomaly note, member vessel types). States: loading = counts show `—`; baseline-not-warm (< 1 day of samples) = "calibrating" pill, no disruption flag; nodata (outside AIS coverage) = greyed row + tooltip "Live AIS coverage: Baltic (keyless)"; error = keep last good. Keyboard: arrow-navigable rows, Enter opens dossier, Esc closes.

### SSRF/proxy
No new cross-origin client calls and no `streamUrl`. Everything is computed server-side from already-fetched JSON. The baseline JSON cache is local. No additions to `lib/proxy/allowlist.ts` needed.

## 5. Dependencies & prerequisites
- **Hard depends on `maritime-ais-vessels`** (provides the `kind:"ship"` `WorldObject[]` and server-side AIS cache).
- Soft-depends on `left-layer-rail`, `dark-ops-console-shell`, and `top-status-metrics-bar` (the header "N of 13" can also surface there).
- No new npm deps — pure TS math, reuses `zod`, `useSyncExternalStore`, and the MapLibre instance.

## 6. Risks & mitigations
- **AIS coverage is regional** → most of the 13 read "nodata" today; mark them honestly and treat the engine as coverage-agnostic so new feeds light corridors up automatically.
- **Cold baseline** → "calibrating" state until ≥1 day of samples; persist median to JSON so a redeploy/cold start doesn't lose history.
- **Anomaly false positives** (storms, weekends) → conservative bands + week-over-week (same weekday) comparison, not raw count.
- **Performance** → point-in-polygon over a few hundred cached vessels × 13 polygons runs in <2 ms server-side, recomputed only on the 30s tick; map renders 13 static features (negligible).
- **ToS** → no new fetches; inherits Digitraffic politeness from the AIS source.

## 7. Acceptance criteria
- [ ] `GET /api/corridors` returns `{ summary:{disrupted,total}, corridors:CorridorStatus[] }`, one entry per chokepoint, and never 500s.
- [ ] All computation is server-side; no upstream URL/stream reaches the client.
- [ ] 13 chokepoint polygons render on the globe, colour-coded by state, with name+count labels and a layer toggle.
- [ ] Panel header shows `N of 13 corridors disrupted`; rows show count + Δ% + state pill; click opens a dossier.
- [ ] Out-of-coverage corridors show "nodata", cold corridors show "calibrating" — never a false "disrupted".
- [ ] `score.ts` unit tests (point-in-polygon + scoring bands) pass; `npm run build` + lint clean.
- [ ] Solo-attributed commit (no Claude trailer).

## 8. Out of scope / future
Airspace-sector and rail/road-artery corridors (same engine, later PRDs); global AIS coverage; per-vessel queue/wait-time estimates; historical disruption timeline charts; push/webhook alerts on state change; weather overlay correlation.
