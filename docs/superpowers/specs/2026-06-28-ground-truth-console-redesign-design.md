# TrafficNerd V2 — Ground-Truth Console Redesign — Design Spec

> Date: 2026-06-28 · Status: Draft (awaiting review) · Owner: Sampo
> Supersedes the direction of `2026-06-27-widgetize-everything-redesign-design.md` (the worldmonitor-style
> widget console) after a 2-round, 6-persona blind-critique exercise showed that console was overwhelming,
> low-signal, and "not a substitute" for anyone's real tool. This spec keeps the *good bones* that shipped on
> `main` (the cinematic globe, the dossiers, the source catalog, freshness/attribution, watchlist/time-window
> scaffolding) and restructures the product around a **console-first, trust-first, ground-truth** thesis.

---

## 0. How we got here (the evidence base)

We ran each of 6 real user personas as a **blind critic**: given the live UI (screenshots of `main`) + the
data, told only their job and their real alternatives, asked to tear it apart and say whether it beats their
tools. Then we redesigned and re-critiqued the *proposed* design. Two rounds:

| Persona | Round 1 | Round 2 | Round-2 stance |
|---|---|---|---|
| OSINT / geopolitics analyst | 2/5 | **3/5** | "Architecture finally right; data *trust* isn't." |
| Commodities / macro trader | 1/5 | **3/5** | "Side scanner, never a trigger — until numbers are provenanced." |
| Emergency / disaster manager | 2/5 | **3.5/5** | "First-look triage screen yes; system-of-record no." |
| Logistics / supply-chain ops | 2/5 | **3.5/5** | "Pilot *alongside* project44, never instead." |
| Newsroom / verification journalist | 2/5 | **3/5** | "Discovery + capture layer yes; verification *source* not yet." |
| Everyday road-conditions driver | 2/5 | **3/5** (4 as cameras) | "Cameras are the real value; route/jams = a worse Waze." |

**Round-1 universal failures (all 6):** the "Top Events" panel was nine near-identical `Active fire — 168 MW
(nominal)` rows with no place/time/dedup; no event time or location on rows; no severity ranking/filter;
the map was dot-soup / label-soup / crime-soup with layers on; no scoping to "what's relevant to me"; no
alerting; trust-breaking contradictions ("Armed Conflict — no data" *during* a US-Iran strike banner; "all
sources live" while feeds paused; an M0.7 quake dossier; mislabeled "MW").

**Round-2 lesson (the strategic one):** the console-first direction is right (everyone moved up), but every
pro independently said TrafficNerd is a **complement, not a replacement**, and named the incumbent *moat* it
cannot cross (Bloomberg/Kpler's quant+desk, project44's live shipment integration, Waze's nav+crowd reports,
Bellingcat's forensic chain). They also all pointed at the *same gap no incumbent fills*: **live, cross-domain,
scoped ground-truth + disruption awareness, with honest provenance — and the live camera as proof.** That is
the wedge this spec commits to.

---

## 1. Product thesis & positioning

**TrafficNerd is the live, cross-domain, ground-truth situational layer** — the one place that fuses live
cameras + flights + ships + hazards + infrastructure/conflict signals into a single *scoped, ranked, sourced*
view, and lets you see the real thing (a live camera, a flight track, a satellite frame) as proof. It is the
**honest complement** that sits next to your primary tool and answers "what is actually happening, right now,
where I care — and can I see it?"

**The signature mechanic** (from the original differentiation research, re-validated by the critics): the
**live camera as ground-truth proof**, reachable in one move from any event, and visible at a glance (working
thumbnails) rather than buried behind clicks.

**Three pillars (everything in this spec serves one of them):**
1. **Scoped relevance** — never the whole firehose; always *near me / this region / this AOI / my watchlist*.
2. **Ranked, sourced events** — a real event feed with time, place, severity, magnitude-in-native-units, and
   provenance; not counts, not spam.
3. **Trust as the product** — honest-empty over full-but-wrong; source independence not "corroboration
   counts"; official-vs-derived badging; visible freshness/latency; transparent severity & baselines.

### 1.1 Explicit non-goals (what we will NOT chase — confirmed by the persona exercise)

- **Turn-by-turn navigation / routing-as-guidance** (Waze/Google own it; the driver said the route/jam layer
  is "a worse Waze"). We do "see your road right now," not "drive me there."
- **Shipment-level ETA / carrier integration** (project44's moat: live ELD/EDI/AWB keyed to *your* loads). We
  do disruption + camera ground-truth on a corridor, not "where is container ABCD."
- **Terminal-grade quant / tradable numbers** (Bloomberg/Kpler). We surface awareness + provenance; we do not
  invent capacity-at-risk numbers anyone would trade on without confirming elsewhere.
- **Forensic chain-of-custody verification** as a legal product (Bellingcat-grade). We give *better* evidence
  capture than a screenshot, clearly labelled for what it is — not a courtroom artifact.
- **Crowd-sourced incident reporting** (Waze's community moat). We use authoritative/official feeds.

Saying these out loud is itself a feature: it keeps us honest and focused, and it's the brand the research
demanded ("everything here is a real, live, attributable feed").

---

## 2. Architecture overview (console-first)

The product flips from "a globe with chrome" to "a **console** with a globe available."

```
ConsoleShell (hydration, ⌘K, dossier overlay, alerts)
 ├─ TopBar          Scope ▾ · Time-window · ⌘K universal search · Alerts🔔 · Explore🌐 switch
 ├─ SourceRail      (left, collapsible) layers/sources + presets ("lenses")
 ├─ MapSurface      the 2D flat MapLibre map (default) — severity-graded, decluttered, layer-priority
 │     └─ (Explore mode swaps this surface to the 3D globe + cinematic dive)
 ├─ EventFeed       (right, the HERO) ranked + scoped + sourced event list  → click row → fly + dossier
 ├─ FeedOverlay     the right-side dossier (camera/plane/sat/signal) — kept + extended
 └─ StatusBar       per-source live/stale/paused health (honest)
```

**One data engine, two surfaces.** The Console (2D, default) and Explore (3D globe, secondary) read the same
normalized **Event store** and the same live layers. Switching modes never changes the data — only the
presentation and the chrome density.

**Reuse, don't rewrite.** `main` already has most of the substrate; this spec evolves it:

| Need | Already on `main` (reuse/evolve) | New work |
|---|---|---|
| Map engine, globe↔flat, clustering, basemaps | `components/WorldMap.tsx`, `lib/map/{features,icons,cluster}.ts` | default to flat; severity encoding; footprint geometry; layer-priority |
| Event aggregation/ranking | `lib/widgets/topEvents.ts`, `useSignalFeatures`, `openSignalFeature` | promote to the full **Event model** + feed |
| Dossiers (the good part) | `components/{Camera,Plane,Satellite,Signal,Webcam}Detail.tsx`, `lib/overlay*` | capture-UTC, evidence-export, camera bearing/FOV/DVR, exposure, track playback |
| Scope: saved places | `lib/shell/watchlist.ts` (pure ops + recall) | extend to AOI/lanes/assets + scope-everything |
| Time window | `lib/shell/timeWindow.ts`, `TimeWindowControl` | wire to feed + map + alerts |
| Source catalog | `lib/sources/catalog.ts`, `lib/signals/*` | add provenance/severity/baseline metadata per source |
| Freshness / source health | `lib/freshness.ts`, `lib/signals/freshness.ts` | per-source latency badge + honest-empty + last-update heartbeat |
| Cinematic dive + thumbnails | `lib/cinematic/*`, `CinematicDive.tsx`, `lib/map/liveThumbnails.ts` | → the Explore mode; **fix thumbnail loading** (most don't render today) |
| Alerts | `lib/shell/alert.ts` (banner dismissal only) | **net-new** relevance-scored threshold alerting |
| Universal search | `components/shell/CommandPalette.tsx` (command-only) | index places + events + entities + sources |

**Retired / folded:** the `DockableWorkspace` + `SourceWidget` count-tiles + the separate
`IntelColumn`/`TopEventsPanel`/`InstabilityPanel`/`RiskPanel`/`ConflictPanel` panels are **replaced by the one
Event Feed** (their data flows into it). `react-grid-layout` drag-the-tiles is dropped — the critics never
wanted a configurable tile wall; they wanted one good ranked feed.

---

## 3. The Event model (the spine)

Every signal — quake, fire, flood, cyclone, conflict event, protest, outage, port-congestion, military
flight of note — normalizes to ONE `Event`:

```ts
interface Event {
  id: string;                       // stable; dedupe key derives from (type, geo-cell, time-bucket)
  type: EventType;                  // 'quake' | 'fire' | 'flood' | 'cyclone' | 'conflict' | 'outage' | ...
  title: string;                    // human, specific ("M5.8 — 9 km N of Anza, CA")
  place: { name: string; admin?: string; country?: string };
  geo: { lat: number; lon: number; precision: GeoPrecision }; // EXACT|CITY|ADMIN|COUNTRY_CENTROID
  footprint?: GeoJSON.Geometry;     // perimeter / flood polygon / cyclone cone / shake contour (not a dot)
  occurredAt: string;               // ISO UTC — EVENT time, never poll time
  severity: { tier: 'S0'|'S1'|'S2'|'S3'|'S4'; basis: SeverityBasis }; // see §10.3
  magnitude?: { value: number; unit: string };  // native unit, correctly labelled (M, MW-FRP, m/s, …)
  exposure?: { people?: number; assets?: AssetCount; method: string; asOf: string }; // §9.4
  baseline?: { deltaPct: number; horizon: '7d'|'30d'|'365d'|'season'; note?: string }; // §10.4
  provenance: Provenance;           // §10.1 — the trust object
  links: { label: string; url: string }[];
}
```

The `Event` is the unit the **feed**, the **map**, the **alerts**, and the **dossier** all read. Adding a
source means "one adapter that emits `Event[]` with provenance" — the existing `lib/signals` registry
contract, plus the provenance/severity fields.

> Evolves `lib/widgets/topEvents.ts` (which already merges quakes/fires/disasters/cyclones and ranks by
> severity-then-recency) into the general model; the data the rows need (magnitude, place, time) already
> rides in each feature's `props` — it simply isn't surfaced today.

---

## 4. The Console layout (default surface)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TrafficNerd  [Scope ▾ Near me·Region·Draw AOI·Watchlist·World]  [15m 1h 6h 24h 7d] │
│              [⌘K search places/events/entities]        [Alerts 🔔]  [Explore 🌐]   │
├───────────┬───────────────────────────────────────────┬──────────────────────────┤
│ SOURCES   │              2D FLAT MAP                   │  EVENT FEED  (the hero)    │
│ /lenses   │  • severity-graded markers (S0–S4)         │  [type ▾ severity ▾ sort ▾]│
│ (rail,    │  • signals clustered like cameras          │  ───────────────────────── │
│ collapse) │  • label-collision avoidance + legend      │  S3 ● Quake  M5.8          │
│           │  • LAYER PRIORITY: cameras+incidents on top │     9km N Anza CA · 12m    │
│           │  • footprint geometry (perimeters/cones)   │     USGS ↗ · exact         │
│           │  • live vs aggregate never same weight     │  S2 ● Wildfire  420 km²    │
│           │  • basemaps: Light / Satellite / Topo      │     Sonoma · 1h · +growth  │
│           │  feed row → fly + pulse marker             │  S2 ● Port congestion      │
│           │  marker → dossier                          │     LA/LB · +18% vs 30d    │
├───────────┴───────────────────────────────────────────┴──────────────────────────┤
│ per-source health: ● live  ◐ stale 14m  ○ paused  ⊘ needs key      (honest, never "all live") │
└──────────────────────────────────────────────────────────────────────────────┘
```

Three zones, each independently understandable: **left** = what's on (sources/lenses), **centre** = where
(map), **right** = what's happening (feed). The dossier slides over the centre on click.

---

## 5. The Event Feed (the hero)

A reverse-chron, **de-duplicated**, **scoped**, sortable/filterable list. The single most important surface.

**Row anatomy:** `severity chip (S0–S4) · type · title (place + magnitude) · age · Δ-vs-baseline · source↗ ·
geo-precision marker`. Example: `S3 ● Quake M5.8 · 9 km N of Anza, CA · 12m · USGS ↗ · exact`.

- **Sort:** severity×recency (default) · time · magnitude · distance-to-scope.
- **Filter:** type · severity floor · time window (shared control) · source.
- **Interactions:** click row → map flies + marker pulses + dossier opens; hover row → marker highlights
  (two-way selection sync, reusing `lib/overlay`).
- **De-dup is conservative + reversible** (§10.5): merged rows show a "▸ 3 reports" disclosure listing the
  distinct members; we never silently collapse two genuinely distinct events.
- **Empty state is explicit and honest:** "No events above S1 in *Near me · last 1h*" with the scope echoed —
  never a blank panel, never a fake "0".

**Per-role projection:** the feed has named **lenses** (presets) that set default type-filters + columns:
*Hazards* (severity→exposure→recency, shows exposure col), *Intel* (conflict/protests/outages, shows
source-independence), *Logistics* (incidents/ports on my lanes, shows ETA-Δ-estimate *labelled as estimate*),
*Markets-watch* (asset-proximity events, shows Δ-vs-baseline), *Roads/near-me* (cameras + road incidents,
shows thumbnails). Same engine, different default projection.

---

## 6. Scope & time-window (the relevance spine)

A single global **Scope** control (top bar) drives the map extent, the feed contents, the counts, and the
alert rules:

- **Near me** — geolocate (reuses `/api/geolocate`, `/api/near`). Default for the road/near-me lens.
- **Region** — place search (reuses `/api/geocode` + `PlaceSearch` + `flyToPoint`).
- **Draw AOI** — box/polygon; "everything in this box, last N hours."
- **Watchlist** — pinned places, drawn lanes/corridors, imported assets. **Evolves `lib/shell/watchlist.ts`**
  (already persists saved places + recalls them) to also hold lanes (polylines) and assets (points with a
  type), and to *filter* the feed/alerts to events intersecting them, not just bookmark a camera.
- **World** — the firehose, explicitly opt-in.

**Time window** (`lib/shell/timeWindow.ts`, already built) is wired to feed + map + alerts so "last 15m / 1h /
6h / 24h / 7d" trims everything consistently. A map time-slider scrubs within the window.

---

## 7. The 2D map (legibility)

The fixes for "the data on the map is horrific":

- **Severity encoding:** marker size/colour = `severity.tier` (one ramp, shared with the feed chips).
- **Cluster signals** the way cameras already cluster (`lib/map/cluster.ts`), so dense event regions collapse
  to counts, not soup.
- **Label-collision avoidance** + a **legend**; labels appear only at zoom and never stack.
- **Layer priority:** cameras + road incidents always render above ambient signals (the things you act on
  win the z-order).
- **Footprint geometry:** render `Event.footprint` — fire perimeters, flood polygons, cyclone cones, shake
  contours — instead of a lone dot (extends `lib/map/features.ts`, which already handles line/area signal
  geometry for cables/jamming).
- **Live vs aggregate are visually distinct and never share weight.** Monthly aggregates (UK street crime) are
  labelled "monthly," styled flatter, and off by default — they must never read as live (the crime-soup of
  Round 1).
- Basemaps unchanged (Light / Satellite / Topographic), all camera-ground-truth-friendly.

---

## 8. Dossiers + the camera ground-truth system (the signature)

The dossiers are the part the critics liked ("the right bones"). Keep them; extend for ground-truth + trust.
The **camera** dossier is the signature surface and the sleeper win every persona valued:

- **Camera metadata** (new): bearing/azimuth, FOV, fixed-vs-PTZ, range, last-move time — so you know *what it
  is looking at* (journalist geolocation; driver "is this my junction"; emergency evac-route framing).
- **Capture-UTC** burned into the frame + **DVR/scrub-back** of a short buffer (verification happens *after*
  the moment; live-only loses it).
- **Working thumbnails:** fix `lib/map/liveThumbnails.ts` so available cameras actually show their live frame
  at zoom (today most stay icons because the proxied images are slow/failing — see §15 P2). This is the
  "see the feed at a glance" promise.
- **Evidence export** (labelled honestly, *not* forensic): frozen frame + burned-in capture-UTC + source +
  coords + URL as one file. We note what time is stamped (fetch vs source-emit) and that streams lag.
- **Event → nearest cameras** (relevance, not just radius): from any event, surface cameras whose
  bearing/FOV plausibly see the footprint, labelled "nearby — viewpoint unverified" (never auto-assert that a
  camera shows the event; the journalist flagged false-confirmation as the single most dangerous feature).

Other dossiers: **plane** gains track playback + position-age + squawk display (with the caveat that
7500/7600/7700 are *emergency* squawks, frequently spurious — not a "military" indicator); **event** gains
occurredAt(UTC) + exposure (§9.4) + footprint + provenance + "nearest live cameras."

### 8.4 Exposure (events)

`Event.exposure` relays authoritative exposure where it exists (e.g. USGS **PAGER** order-of-magnitude
population-by-intensity with its stated uncertainty) rather than recomputing it, and labels everything with
`method` + `asOf`. Asset counts (hospitals/schools in footprint) come from OSM/HIFLD with a freshness date.
We show ranges + uncertainty, never false-precise single numbers.

---

## 9. Alerts (relevance-scored, entity-keyed)

Net-new (today's `lib/shell/alert.ts` is only banner-dismissal). A rule = `{ scope|asset, type[], severityFloor,
window }` → in-app + (opt-in) push. Built to *not* cry wolf:

- **Relevance, not radius:** an alert fires on `event-type × asset-type` relevance, not mere distance (a brush
  fire on a refinery fence-line shouldn't page the energy desk). Entity-keyed (this lane / this asset / this
  AOI), deduped against the feed's dedup.
- **Official vs derived badging:** alerts relayed from official CAP/NWS/NHC are marked authoritative; alerts
  *we* derive (a FIRMS fire-growth threshold) are badged "UNOFFICIAL — not for dispatch." (Emergency manager:
  this distinction is the whole game.)
- The existing anti-"crying-wolf" dismissal idiom (remember the dismissed key) carries over per-rule.

---

## 10. Trust & provenance (the brand, made into a system)

This is the layer Round 2 said is missing, and it *is* the differentiation. Cross-cutting requirements:

**10.1 Provenance object** on every Event/datum: `{ sources: {name, tier, firstSeenAt, role:'primary'|'echo',
url}[], latencyMs, derivation?: string }`. Surfaced in the row (source↗ + a tier marker) and the dossier.

**10.2 Source independence, not "corroboration counts."** We show *distinct primary sources* (GDELT copying
one wire 200× is one source, not 200). Echoes are collapsed and labelled. No bare count ever implies
confidence.

**10.3 Severity is per-domain + transparent.** A single S0–S4 *display* ramp, but the *basis* is
domain-specific and shown (`SeverityBasis`): quakes by magnitude+depth+exposure, fires **exposure-weighted**
(a 20 MW WUI fire outranks a 168 MW wilderness fire), conflict by fatalities+confidence — never one naive
global number. FIRMS confidence (`nominal/high`) is **never** shown as severity.

**10.4 Baselines are multi-horizon + seasonal.** `Δ-vs-baseline` offers 7d/30d/365d/same-season, guards
against baseline-poisoning (a 60-day Suez closure must not become "normal"), and for media-derived sources
(GDELT) is labelled "media-volume Δ, not event Δ." Chronic state (a country sitting at instability 49
forever) is suppressed; only *change* surfaces.

**10.5 Honest-empty + source-health over full-but-wrong.** Every source carries a live/stale/paused/needs-key
state + last-update heartbeat + latency badge (extends `lib/freshness.ts`). A lagging curated source (ACLED is
days behind) shows **honestly empty** during a live event rather than being back-filled with noisy real-time
proxies presented at equal weight. The status bar can never say "all live" while a feed is paused. A clean map
during a data gap must read as "no data," not "all clear."

**10.6 Geo-precision is explicit.** `GeoPrecision` (EXACT/CITY/ADMIN/COUNTRY_CENTROID) is rendered — centroid-
geocoded events (GDELT "Iran" → a mid-country dot) are drawn with an uncertainty halo, never a precise pin.

**10.7 Dedup is conservative + reversible** (see §5) — undercounting two real events or flattening a
fore/aftershock sequence is treated as a worse failure than a near-dup slipping through.

---

## 11. Explore mode (the demoted globe)

The 3D globe + cinematic dive (`lib/cinematic/*`, `CinematicDive.tsx`) becomes the secondary **Explore 🌐**
mode behind the top-bar switch: calm, decluttered, severity-scaled, "wander the planet," with working live
thumbnails on descent. Same Event engine; lower chrome density. It keeps the wonder/marketing appeal the
research valued, without being the default work surface.

---

## 12. Per-role payoff & honest boundary

| Persona | What now serves them | The boundary we accept (non-goal) |
|---|---|---|
| OSINT analyst | scoped event feed w/ UTC+coords+source-tier+geo-precision; AOI+time; mil-air *of note*; export; honest-empty conflict | not a correlation/causal engine; ACLED lag shown, not faked |
| Trader | asset-proximity feed, Δ-vs-baseline, live AIS chokepoint deltas, alerts; magnitude in native units w/ provenance | no tradable capacity-at-risk numbers; "awareness then confirm in Kpler" |
| Emergency | severity (exposure-weighted) + footprint + exposure + **official CAP relayed**, one-tap evac cameras, push | derived alerts badged UNOFFICIAL; not a system-of-record |
| Logistics | scope-to-my-lanes, road-incident layer + camera-as-proof, port-dwell, lane alerts/export | not shipment-level ETA (project44's moat); ETA-Δ labelled "estimate" |
| Journalist | UTC+dedup wire, evidence export, camera bearing/FOV/DVR, event→camera (labelled unverified), ⌘K over data | not forensic chain-of-custody; fusion never auto-asserts |
| Driver | near-me/route lens: working camera thumbnails, "updated 2m ago," road incidents, fixed mobile | not navigation; "see your road now," not "drive me there" |

---

## 13. Phased delivery

Each phase is independently shippable, build-green, solo-attributed (repo convention). Phase 1 delivers the
visible payoff (the feed + console + scope); trust depth and per-role lenses layer on.

- **P1 — Console + Event model + Event Feed.** Normalize signals → `Event[]` (evolve `topEvents.ts`); the
  console layout (default flat map + right feed); rows with type/place/UTC/severity/source; click→fly+dossier;
  the **Scope** control (near-me/region/AOI/world) + time-window wired through; retire the dock/IntelColumn
  panels into the feed. *This alone fixes the Round-1 "Top Events" disaster.*
- **P2 — Map legibility + camera ground-truth.** Severity encoding, signal clustering, label-collision,
  layer-priority, footprint geometry, live-vs-aggregate split; **fix live thumbnails**; camera dossier
  metadata (bearing/FOV/PTZ) + capture-UTC + DVR + evidence-export.
- **P3 — Trust & provenance system.** Provenance object + source-independence display; geo-precision rendering;
  honest-empty + per-source latency/health; transparent per-domain severity; multi-horizon baselines;
  conservative reversible dedup.
- **P4 — Scope deepening + Alerts.** Watchlist → lanes + imported assets (CSV) + scope-everything;
  relevance-scored, entity-keyed alerts with official-vs-derived badging + push; universal ⌘K (places/events/
  entities). Exposure (PAGER relay) + footprint sources.
- **P5 — Lenses + new live data + Explore polish.** Per-role lenses (Hazards/Intel/Logistics/Markets/Roads);
  live AIS + weather radar (unblock trader/logistics); road-incident layer; Explore mode polish; mobile
  feed-first.

(Phases 2–4 can reorder; P1 ships the feed-first console first.)

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Provenance/severity/baseline shipped naively → re-introduces the distrust we're fixing | §10 is first-class, not a footnote; each lands with its source-independence/precision/honest-empty rules + tests |
| "One Event model" flattens native fields pros triage on (AIS draught, ADS-B climb) | Event carries a typed `raw` payload; the dossier renders native fields per type |
| Alert fatigue kills the feature (first false 3am push → muted forever) | relevance (type×asset) not radius; entity-keyed; deduped; official-vs-derived; per-rule dismissal |
| Camera ground-truth over-promises (thumbnails fail today; "nearest camera" mis-associates) | P2 fixes thumbnail loading w/ a verified budget; event→camera is bearing/FOV-aware + labelled "unverified" |
| Scope creep back toward the incumbent moats | §1.1 non-goals are binding; lenses *project* the same engine, they don't fork it |
| Big restructure destabilizes a working `main` | reuse map (§2) — evolve existing stores/components; phased; build+vitest green per phase |

## 15. Open questions (for review)

1. **Default scope on first load:** Near-me (driver-friendly, needs geolocation permission) vs World (no
   prompt, but firehose)? Lean: **Near-me with a graceful World fallback** if permission denied.
2. **Lens vs scope coupling:** does choosing the "Hazards" lens also set a sensible default scope/time, or are
   they fully orthogonal? Lean: lens sets *defaults* the user can override.
3. **How much of P5's new live data (AIS, weather radar) is in-scope now** vs a follow-on — they unblock 2
   personas but add real ingestion/cost.
4. **Explore mode prominence:** a top-bar peer toggle, or a softer "globe" affordance? (Marketing wants the
   globe visible; the work surface is the console.)
5. **Name/Framing:** "TrafficNerd" undersells a cross-domain ground-truth layer — revisit, or lean into the
   transport/observation identity?
