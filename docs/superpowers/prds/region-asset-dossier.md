# PRD: Region / asset dossier panel
> Priority: P1 · Effort: L · Status: Proposed · Category: detail-panel

## 1. Summary
The **dossier** is TrafficNerd's canonical right-side slide-in detail panel: click any object on the globe and a structured brief slides in with identity, live evidence, cited context, active signals, a recent-track timeline, and nearby/exposure context — copyable as Markdown. A minimal version already ships as the modal `components/FeedOverlay.tsx` + per-kind bodies (`CameraDetail`, `PlaneDetail`, `SatelliteDetail`). This PRD upgrades that into a non-modal right-rail **DossierShell** with one consistent section layout shared by all kinds (camera, plane, satellite, and ship when maritime lands), adds flight enrichment via adsbdb, and adds Markdown export.

## 2. Why it matters for TrafficNerd
The dossier is the product payoff — "see the actual place, live." It is also the information-architecture template every domain panel mirrors (the aviation-intelligence PRD already calls it "the right dossier"). Standardising it now means each new layer only writes an Evidence slot, not a whole panel, and the keyless honesty story (provenance citations, session-only timeline) is decided once.

## 3. worldmonitor.app reference
worldmonitor opens a country dossier with a risk **score** + breakdown, an AI brief citing headlines, active signals/incidents, a 7-day timeline, and infrastructure-exposure mapping, exportable as Markdown. We keep the **shape** (header → brief w/ citations → signals → timeline → context → export) but adapt honestly to keyless data: no LLM brief and no risk score (we have neither key nor ground truth) — instead a **freshness/confidence chip**, a factual brief whose citations are **data provenance** (adsb.lol, adsbdb, CelesTrak, the camera operator), and a **session-lifetime** track timeline (no keyless multi-day store). We keep Markdown export verbatim.

## 4. How we build it (TrafficNerd-specific)

**Data sources (keyless, all server-laundered).** Reuse `lib/sources/adsb.ts` (positions), `lib/satellites/propagate.ts` (SGP4 next-passes), Esri World Imagery export (already in `SatelliteDetail`) for satellite ground + a static plane-route base map, and `/api/camera/[id]` for camera records. **Add** `lib/sources/adsbdb.ts` calling `https://api.adsbdb.com/v0/callsign/{callsign}` (route → origin/dest airport ICAO + lat/lon) and `https://api.adsbdb.com/v0/aircraft/{hex}` (registration, type, `url_photo`). Nearby cameras come from `lib/geo/haversine.ts` over the live camera array — no fetch.

**State / stores.** Keep `lib/overlay.ts` (the `useSyncExternalStore` single-object store) as the open/close source of truth; no new store needed.

**Components.** Refactor `components/FeedOverlay.tsx` from a centred modal into a right-rail slide-in (≈400px, non-modal so the globe stays interactive). **Add** `components/dossier/DossierShell.tsx` (sections: Header, Evidence slot, Brief, Signals, Timeline, Context, ExportBar), `components/dossier/DossierTimeline.tsx` (altitude/speed sparkline + breadcrumb list from `lib/planes/trail.ts`), `components/dossier/CitationChips.tsx`. Rework the three detail bodies to fill the shell's Evidence + Context slots; **add** `components/ShipDetail.tsx` (MMSI/type/destination) gated until maritime ships.

**Logic (pure, unit-tested).** Add `lib/dossier/brief.ts` (`WorldObject` + enrichment → `{ text, source }[]` facts) and `lib/dossier/markdown.ts` (serialise the open dossier to a `.md` string for copy/download).

**API.** Add `app/api/aircraft/[hex]/route.ts` and `app/api/flight/[callsign]/route.ts` — server-side adsbdb fetch + short in-memory cache, so the client never calls adsbdb directly (avoids CORS and laundering). Add the adsbdb photo CDN host (e.g. planespotters) to `lib/proxy/allowlist.ts`. Update `lib/world.ts` `WorldObjectKind` to include `"ship"`.

**UX/states.** Slides from the right; `Esc`/× close; focus moves into the panel and restores on close (keep `FeedOverlay`'s focus handling), `Tab` cycles within it; deep-linkable via shareable-deep-links (`?focus=<id>`). Per-section skeletons; enrichment is lazy on open; degrade gracefully ("route unavailable", "Could not load this camera"). Export button copies Markdown + shows a toast.

**SSRF/proxy.** Unchanged invariant: media flows only through `/api/proxy` (images) and `/api/hls` (video); the client never sees a raw `streamUrl`. The adsbdb `url_photo` is rewritten to `proxy?url=` before render; adsbdb JSON is fetched only in the new API routes.

## 5. Dependencies & prerequisites
- `flight-tracking` (adsb positions + `lib/planes/trail.ts`), `live-webcams-layer`, `satellite-orbit-tracking` — supply the kinds.
- `dark-ops-console-shell` + `left-layer-rail` (chrome). Soft: `maritime-ais-vessels` (ship body), `shareable-deep-links`, `data-freshness-ticker`.
- No new npm dependencies.

## 6. Risks & mitigations
- **"Multi-day timeline" overclaim:** keyless = no persistence; timeline is session-lifetime track + (for satellites) computed next-passes. Label it honestly; don't fake 7 days.
- **No-LLM brief / no score:** resist faking a risk score; use a freshness/confidence chip and provenance citations.
- **adsbdb rate limits:** enrich only on open, server-cache per hex/callsign; never bulk-enrich.
- **Photo host not allowlisted:** add the CDN host; missing photo degrades to no-image.
- **Modal→slide-in migration:** keep `/camera/[id]` standalone fallback; guard the kind switch `default`.

## 7. Acceptance criteria
- [ ] Clicking any globe object opens a right slide-in dossier with the shared section layout; `Esc`/× close and restore focus.
- [ ] Plane dossier shows route (origin→dest) + registration/type/photo (proxied) from adsbdb, plus the live track timeline.
- [ ] Camera shows the proxied live stream/image + nearby cameras; satellite shows ground imagery + next-pass timeline; ship body stubbed behind the maritime dep.
- [ ] Every non-obvious fact carries a citation chip; "Copy as Markdown" yields a valid dossier `.md`.
- [ ] No raw `streamUrl`/upstream URL reaches the client; adsbdb is called only server-side.
- [ ] `lib/dossier/brief.ts` and `lib/dossier/markdown.ts` unit-tested; `npm test` green.

## 8. Out of scope / future
True multi-day history (needs a store), AI-generated brief and headline/news citations (keyless RSS later), geopolitical risk score, ship dossier until maritime ships, multi-window/comparison dossiers, and a downloadable multi-file bundle (single `.md` only for v1).
