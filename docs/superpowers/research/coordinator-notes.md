# TrafficNerd v2 — Coordinator Synthesis (research → spec bridge)

> Fuses `research/camera-sources.md`, `research/differentiation.md`, and the 26 per-feature PRDs in `prds/` into one decisive direction for the design spec. Written 2026-06-26. Owner decisions are flagged **[DECISION]**; the Prospector Reddit sweep is not yet in — see §7.

---

## 1. Strategic synthesis

**The defensible wedge is the seamless globe→live-video zoom that ends on a verified-fresh, real moving image — wrapped in a calm, light, photographic identity and a transport/exploration tone.** Every competitor (Vizzion ~80k cams, TrafficLand ~25k, TrafficVision ~130k) already won "all the world's cameras on one map." That is **table stakes, not a differentiator.** What none of them do, and what the evidence shows users actually hate the absence of, is:

1. **Zoom-to-live-video** — a continuous space→street descent that *lands on a real moving frame* (differentiation #1; answers the trust gap, the stills-not-video gap, and converts firehose anxiety into "see it yourself").
2. **Visible freshness** — dead/stale feeds are the #1 complaint across every competitor. "We only show cameras that are actually live right now" is a line rivals can't credibly say.
3. **Calm light identity** — the dark neon "movie-hacker" dashboard is the saturated, *mocked* aesthetic (a dev literally built a minimal TUI because worldmonitor was "extremely overwhelming"). Light + photographic + restrained is itself differentiation.
4. **Honest coverage + transport/exploration tone** — own wonder ("travel the planet, watch a ferry dock live"), not threat-intel dread; show where coverage is *thin*, never overclaim "global."

**What this means for scope.** "More cameras" is reframed from count-bragging to **coverage honesty + freshness + rural/global reach**. The unified MapLibre globe, instant load, the zoom-to-live-camera payoff, per-source freshness, and the dossier are the wedge-defining P0 set — everything else is in service of, or subordinate to, that. The dense multi-panel "ops console" is **demoted**: it is the exact overload/sameness anti-pattern the research warns against. We keep its *useful mechanics*, not its *identity* (see §2). Multimodal layers (planes, sats, ships, weather) are a genuine "everything that moves" convergence — but they win only with **restraint and layer choice**, default-calm, not a 45-layer firehose.

---

## 2. Identity decision — reconcile "ops console" vs calm/light/photographic

An earlier decision chose a "full worldmonitor-style ops console," and four P0/P1 PRDs are written to that brief (`dark-ops-console-shell`, `top-status-metrics-bar`, `left-layer-rail`, `data-freshness-ticker` all say "dark, dense, monospaced, Bloomberg-for-transport"). The differentiation evidence directly contradicts the *identity*, while validating the *mechanics*.

### RECOMMENDATION (flag **[DECISION 1]** for Sampo)
**Keep the shell mechanics; replace the shell identity.**

| Keep (mechanics — genuinely useful) | Replace / drop (identity — the mocked anti-pattern) |
|---|---|
| Layer rail (collapsible) with toggles + live counts + provenance/explainer cards | The permanent **panel-grid** flanking the map (Aircraft/Cameras/Satellites/Incidents/Status tiles, drag-to-reorder) — this crowds the map and *is* the overload complaint |
| Right slide-in **dossier** (one shared section layout) | All-monospace, neon-on-black palette; translucent-neon modals |
| Thin **top status bar** (a few live counts + health badge) | "DEFCON"/threat-board framing and dense aggregate counters |
| Bottom **freshness ticker** (per-source age + stale flag) | Dark-by-default theme |
| `Ctrl/Cmd-K` command palette; hidden-layer-doesn't-fetch gating; localStorage view persistence | Information density as the primary aesthetic value |

**Shift the identity to:** calm **light** photographic theme (evidence-backed; Sampo's instinct confirmed); **globe-as-hero** (full-bleed map, chrome is thin and recedes); **live-camera-thumbnail markers** at close zoom (concrete ground-truth, not dot-soup); **progressive disclosure by altitude** (globe shows almost nothing — a few aggregated glows — detail materializes on descent, making "too many dots" structurally impossible); **restrained typography** (real type; monospace reserved for numerics only); **exploration/curiosity tone** in all copy.

Net effect on the PRDs: rewrite `dark-ops-console-shell` into a **"Calm console shell"** — same structural slots (top bar / left rail / map hero / right dossier / bottom ticker), same hidden-don't-fetch + persistence + keyboard/fullscreen contracts, but light-default, globe-hero, and **without** the permanent reorderable panel-grid. Domain panels (aviation, corridors) become **on-demand slide-ins**, not always-on tiles. Keep a dark-mode toggle as an *option* (the shell already supports `data-theme`), default light.

---

## 3. Prioritized feature roadmap (26 PRDs re-bucketed)

Buckets below are re-derived from the **wedge**, not copied from PRD headers. Where I move a PRD off its stated priority, the reason is given. Effort in (S/M/L).

### P0 — Foundational wedge (the product is not real without these)
| PRD | PRD pri | Note |
|---|---|---|
| `unified-globe-flat-map-engine` (L) | P0 | The canonical single-MapLibre-globe decision. Everything layers on it. **Swap basemap from dark-matter → light (§5).** |
| `zero-friction-instant-load` (M) | P0 | Globe + cameras + planes visible in seconds, no signup. The wedge fails if first paint is slow. |
| **Calm console shell** (was `dark-ops-console-shell`, L) | P0 | **Re-scoped per §2** — keep slots/gating/persistence, drop panel-grid + dark identity. |
| `left-layer-rail` (M) | P0↑ | *Promoted* (PRD says P1). It is shell-foundational; the dossier + freshness + ticker all dock around it. Light-restyle. |
| `region-asset-dossier` (L) | P0↑ | *Promoted* (P1). The dossier **is the zoom payoff** — the "see the actual place, live" moment. Wedge-critical. |
| `data-freshness-ticker` (M) | P0↑ | *Promoted* (P1). Freshness is differentiation #2; it must ship with the wedge, not after. |
| `top-status-metrics-bar` (M) | P0 | Thin, light restyle. Trims to a few counts + health badge (drop DEFCON framing). |

### P1 — Core live layers + the zoom/freshness payoff
| PRD | PRD pri | Note |
|---|---|---|
| `live-webcams-layer` (M) | P1 | Camera **health/freshness + graceful fallback** (live video→still→last-good→greyed). This carries the freshness wedge; effectively co-P0. |
| `flight-tracking` (L) | P1 | adsb.lol positions + **adsbdb route/airframe enrichment** + military split. The most visually alive layer. |
| `satellite-orbit-tracking` (M) | P1 | SGP4 layer + overhead/next-pass. **Reconcile: retire react-globe.gl object layer + `lib/altitude.ts` shell (see §6).** |
| `smart-marker-clustering` (M) | P1↑ | *Promoted* (P2). Without it the globe is dot-soup = the #1 overload anti-pattern. It *is* the altitude-LOD de-clutter mechanism. |
| `responsive-mobile-shell` (M) | P1 | Transport is a phone check; the sluggish-UI complaint is real. Bottom sheets, 44px targets, trimmed default layers. |
| **Near-me / spatial search** (M, *no PRD yet*) | — | **GAP — see [DECISION 4].** Differentiation #5 ranks this highly; no PRD covers geolocate + "cameras near me" + place search. Create it at P1. |

### P2 — Enhancements (depth once the wedge is solid)
| PRD | PRD pri | Note |
|---|---|---|
| `maritime-ais-vessels` (M) | P1→P2 | *Demoted.* Ships are great convergence but Baltic-only (keyless) and not wedge-critical; land after the air/ground/space core is calm and fresh. |
| `regional-preset-views` (S) | P2 | Cheap, high-value fly-to demo path. **Reconcile react-globe.gl `RegionView` → fitBounds/flyTo (§6).** |
| `shareable-deep-links` (M) | P2 | URL-as-state. **Reconcile `z` from GlobeView POV-altitude → MapLibre zoom (§6).** |
| `weather-natural-events-layer` (L) | P2 | Genuine "why is this road jammed" context. Keyless (drop FIRMS/ERA5). |
| `time-window-filter` (M) | P2 | Temporal axis for trails + incidents. |
| `gps-jamming-zones` (M) | P2 | Niche but credible transport-intel. **Reconcile `<Globe polygonsData>` → MapLibre fill (§6).** |
| `monitor-variants` (M) | P2 | aviation/maritime/cameras/orbital presets from one engine — strong "platform" portfolio story. Light per-accent theming. |
| `aviation-intelligence-panel` (L) | P2 | On-demand slide-in (NOT a permanent grid tile). Depends on `flight-tracking`. |
| `custom-watch-monitors` (M) | P2 | Personal radar; keyless, high perceived value, pure client. |
| `news-and-live-video-feeds` (M) | P2 | The **persistent single HLS player** half is a real bandwidth win for rapid camera-clicking — pull that sub-feature earlier; the RSS strip can wait. |

### P3 — Nice-to-have (defer past v1 launch)
| PRD | PRD pri | Note |
|---|---|---|
| `maritime-chokepoints` (M) | P2→P3 | *Demoted.* Hard-depends on AIS (itself demoted) and a self-built baseline. |
| `breaking-alert-banner` (M) | P2→P3 | *Demoted.* Corroboration engine is elegant but depends on many layers; risks the "crying wolf" / anxiety anti-pattern if rushed. |
| `multiplatform-distribution` (M) | P3 | PWA + Wall Mode + i18n seam. Good portfolio polish, post-core. |
| `configurable-alerting-and-digests` (L) | P3 | Telegram/cron rules engine. Explicitly YAGNI for the core map. |

### PRDs that assume the OLD react-globe.gl hybrid — must reconcile to single-MapLibre-globe (§6)
`satellite-orbit-tracking`, `gps-jamming-zones`, `regional-preset-views`, `shareable-deep-links`, plus every PRD that references **both** `GlobeView.tsx` and `MapView.tsx` as live render paths (`zero-friction`, `dark-ops-console`, `top-status-metrics-bar`, `responsive-mobile-shell`, `custom-watch-monitors`, `smart-marker-clustering`, `weather-natural-events`). All should target the single `WorldMap.tsx` the engine PRD introduces.

---

## 4. Camera rollout plan (keyless-first, freshness-framed)

**Framing:** order by integration ease × *coverage diversity* (new countries/rural), **not** raw count. Every source passes the camera-health/freshness gate (`live-webcams-layer`) before it is shown; the UI ships an **honest per-region coverage view** that shows where we *don't* have feeds. Running totals are an internal capacity figure, **not** a marketing headline.

### Keyless tier (build with zero registration) — build order from research §D
| Step | Source | Coverage | ~Adds | Running total | Key gotcha |
|---|---|---|---|---|---|
| 0 | *Existing* (TfL, Caltrans, SCDOT, Digitraffic) | UK/US/Finland | — | **~3,330** | live baseline |
| 1 | **Castle Rock "511"** (1 adapter → 9 systems) | US FL/GA/NY/ID/New England + CA ON/AB/NS/NB | ~13,480 | **~16,810** | `POST /List/GetData/Cameras`; WKT `POINT(lon lat)` — **lon first**; snapshot `…/map/Cctv/{id}`, not auth HLS |
| 2 | **Oregon TripCheck** | US Oregon rural+hwy | ~1,127 | ~17,940 | plain `latitude`/`longitude` (ignore wkid:3857 label) |
| 3 | **DriveBC** | Canada BC | ~1,058 | ~19,000 | `coordinates [lon,lat]`; `marked_stale` flags dead cams |
| 4 | **NZTA** | New Zealand (new hemisphere) | ~320 | ~19,320 | `Accept: application/json`; use camera node's own lat/lon |
| 5 | **Iceland Vegagerðin** | Iceland rural/mountain pass | ~200 | ~19,520 | group by `Maelist_nr`; or pre-grouped `umferdin.is` |
| 6 | **Estonia Tark Tee** | Estonia | ~179 | ~19,700 | use `tram/` layer; re-query per refresh (timestamped path) |
| 7 | **Scotland Traffic Scotland** | Scotland | ~414 | **~20,110** | image is base64-in-HTML, not a direct .jpg |
| (opt) | Wales (images keyless; coords need free DATEX) | Wales | ~200 | ~20,310 | weak until coords sourced |

**Keyless total ≈ 20,100 cameras across ~9 countries/regions from a handful of adapters.**

### Free-key tier (gated on Sampo obtaining keys) — **[DECISION 3]**
| Source | Coverage | ~Adds | Worth a key? |
|---|---|---|---|
| **Windy Webcams v3** | **Global** tourism/ski/beach/harbor/pass webcams | **~70,000+** | **Yes — high.** Single source delivers the entire "global webcams" requirement. Caveats: image URL **token expires 15 min** (re-fetch list, don't cache), free tier low-res, **attribution MANDATORY** ("Webcams provided by Windy.com" + per-image link back). Treat as a separate **Webcams** sub-layer, distinct from traffic CCTV. |
| **Sweden Trafikverket** | Sweden (new country) | ~1,600 | **Yes — medium.** Clean schema, instant free key. `Geometry.WGS84 POINT(lon lat)`. |
| Norway Statens vegvesen | Norway | ~400 | Maybe — Basic-Auth + Datex II XML, NLOD attribution. |
| Australia NSW / QLD | NSW/QLD | large | Maybe — clean GeoJSON, free keys; later. |

**Cross-cutting:** nearly all road feeds are **JPEG snapshots not HLS** (`imageUrl` + `refreshSeconds` 60–300); several put **longitude before latitude** (Castle Rock, DriveBC, Sweden) — normalize carefully; allowlist each new host in `lib/proxy/allowlist.ts`; media already proxied so source CORS is a non-issue. **Dead ends (don't spend time): Germany Autobahn (emptied), Denmark, Netherlands (GDPR), Ireland, Switzerland, webcams.travel (→Windy).**

---

## 5. Light-mode basemap recommendation

The engine PRD currently specs CARTO **dark-matter**; for the calm-light identity swap to a light vector style (globe projection needs a *vector* style, not raster). Top keyless candidates:

| Basemap | Style URL | Key? | Notes |
|---|---|---|---|
| **CARTO Positron** | `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` | **No** | Light counterpart to dark-matter — **drop-in swap**, same family/ToS already accepted, clean/calm/neutral, globe-compatible. ToS-bound demo tiles (fine at portfolio scale). |
| **OpenFreeMap** (positron / liberty / bright) | `https://tiles.openfreemap.org/styles/positron` | **No** | Fully free, **no key, no rate limit, self-hostable** (OSM-community run). Best insurance against CARTO volume/ToS limits. |
| Stadia/Stamen "Alidade Smooth" | (Stadia) | **Key for prod** | Beautiful light style but needs an API key / domain auth in production (keyless on localhost only) — fails the keyless constraint. |

**RECOMMENDATION (flag **[DECISION 2]**):** default to **CARTO Positron** (zero-effort swap from the already-specced dark-matter, same attribution discipline), with **OpenFreeMap Positron/Liberty** wired as a fallback/escape hatch if CARTO ToS or volume bites. Keep **Esri World Imagery** (already used) as the deep-zoom **photographic** layer — Positron at globe scale → Esri imagery on descent → live camera frame is exactly the calm-light-to-photographic arc the wedge needs. (MapTiler/Mapbox excluded: key required.)

---

## 6. Map-engine reconciliations required in the spec

The single-MapLibre-globe decision (`unified-globe-flat-map-engine`) supersedes the react-globe.gl + MapView hybrid that most PRDs were drafted against. The spec must explicitly reconcile:

1. **Delete the dual-engine assumption.** Replace all `GlobeView.tsx` **and** `MapView.tsx` references with the single `WorldMap.tsx`. Engine PRD already calls for deleting both after parity — every other PRD inherits that.
2. **`gps-jamming-zones`** — drop the `<Globe polygonsData>` / `polygonCapColor` / `polygonAltitude` / `onPolygonClick` path; ship only the MapLibre `fill`+`line` GeoJSON path it already describes.
3. **`satellite-orbit-tracking`** — retire the react-globe.gl object layer **and** `lib/altitude.ts` shell mapping (engine PRD says encode altitude as a dossier badge, plot at sub-point lat/lon).
4. **`regional-preset-views`** — replace react-globe.gl `RegionView {lat,lng,altitude}` with MapLibre `fitBounds`/`flyTo` (PRD already drafts this; mark the legacy shape removed).
5. **`shareable-deep-links`** — the `z` param must encode **MapLibre zoom**, not GlobeView `MAP_THRESHOLD`/`EXIT_ALTITUDE` POV-altitude.
6. **Progressive disclosure by altitude (§2)** is now a first-class engine responsibility (zoom-gated visibility + clustering), not an afterthought — bake it into the engine + clustering PRDs.

---

## 7. Open decisions for Sampo

1. **[DECISION 1 — identity, the big one]** Confirm the shift from "dark dense ops console" to **calm / light / photographic / globe-as-hero / exploration tone**: keep shell *mechanics* (layer rail, dossier, freshness ticker, thin status bar, Cmd-K, hidden-don't-fetch, persistence), **drop** the permanent reorderable panel-grid and the dark-neon identity; domain panels become on-demand slide-ins; dark mode survives only as an optional toggle.
2. **[DECISION 2 — basemap]** Approve **CARTO Positron** as the default light basemap with **OpenFreeMap** as fallback (both keyless), Esri imagery for deep-zoom photographic payoff.
3. **[DECISION 3 — keys]** Will you obtain **Windy** (unlocks ~70k global webcams; 15-min token + mandatory attribution) and **Sweden** (clean, new country) keys? Norway/AU optional/later. Keyless build proceeds regardless to ~20k cams.
4. **[DECISION 4 — near-me gap]** There is **no PRD** for "near me / spatial place search," yet the research ranks it a top user need (differentiation #5). Approve authoring it as a **P1** PRD (geolocate, "cameras near me," search-by-place, fly-there).
5. **[DECISION 5 — live-thumbnail markers]** Adopt **live camera-preview thumbnails as the markers** at close zoom (differentiation #3, concrete ground-truth)? Has a perf/proxy cost (LOD + thumbnail caching) — recommend yes, gated to high zoom only.
6. **[DECISION 6 — count honesty]** Confirm we present **freshness + honest per-region coverage**, never a "20k / 90k cameras" headline (the dishonest-"global" complaint is loud). Internal totals only.
7. **[DECISION 7 — v1 cut line]** Recommend v1 ships P0+P1 (+ a slice of P2: presets, deep-links, persistent HLS player), and **defers** all alerting (`breaking-alert-banner`, `configurable-alerting-and-digests`), `maritime-chokepoints`, and `multiplatform-distribution` to post-launch. Confirm.

---

## 8. Pending — Prospector Reddit sweep

The `differentiation.md` complaints were largely from App Store / HN / forum proxies because **Reddit was 403-blocked** to the research tool; several user-need signals (notably the "is there one single site for all cameras" wish and rural-coverage demand) are flagged INFERRED. The **Prospector OAuth Reddit sweep is not yet in.** When it lands:

- Fold confirmed/new unmet-needs into §1 (wedge) and §3 (roadmap re-prioritization).
- Specifically validate or revise: the near-me gap (§7.4), the count-honesty stance (§7.6), and any rural/non-US coverage demand that would re-order the camera rollout (§4).
- **Leave this section as the merge slot** — update in place rather than appending a second analysis.

---
*Synthesis complete. This document is the agreed bridge from research to the design spec; resolve §7 decisions before the spec is frozen.*
