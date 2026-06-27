# PRD: Six tuned monitor variants
> Priority: P2 · Effort: M · Status: Proposed · Category: ui-shell

## 1. Summary
Ship multiple themed "monitors" from one codebase. Each variant pre-curates which layers are on, which camera feeds matter, the default map view/zoom, the accent colour, and the title — without forking the engine. A single MapLibre globe instance, the existing layer/filter stores, and the WorldObject contract stay shared; a variant is just a named config object plus a thin selector. Variants are reachable by subdomain (`aviation.`, `maritime.`, `cameras.`, `orbital.`) and by an in-app switcher. Outcome: four to six focused, instantly-loadable transport dashboards that look bespoke but cost one render path to maintain.

## 2. Why it matters for TrafficNerd
The full map (3,300 cameras + hundreds of planes + satellites) is dense. Different viewers want different lenses: a plane-spotter wants aircraft + airport routes; a logistics watcher wants ports/ships/chokepoints; a city-ops viewer wants CCTV first. Variants give each audience a zero-friction, pre-tuned entry point — and make the project demo as a *platform*, not a single page, which is the portfolio story.

## 3. worldmonitor.app reference
worldmonitor runs World/Tech/Finance/Commodity/Energy/Happy from one engine: same map, different default layer set, feed list and accent colour, served on variant subdomains. We adapt this exactly — same engine, different defaults — but the variants are transport-themed presets, not news verticals.

## 4. How we build it (TrafficNerd-specific)
**Data sources:** none new. Variants only re-weight the existing keyless feeds (TfL, Caltrans, SCDOT, Digitraffic cameras; adsb.lol + adsbdb planes; CelesTrak satellites). Future ship/airport/NOTAM layers slot in as new `LayerKey`s without touching variant plumbing.

**Config (the core):** add `lib/variants.ts` exporting a `VariantConfig` and a `VARIANTS` record:
```ts
export interface VariantConfig {
  slug: "world" | "aviation" | "maritime" | "cameras" | "orbital";
  title: string; accent: string;          // CSS hex → drives --accent
  layers: Partial<LayerState>;            // default on/off per LayerKey
  cameraFilter?: Partial<CameraFilterState>; // default regions / liveOnly
  initialView?: { lon: number; lat: number; zoom: number };
}
```
Examples: `aviation` = `{planes:true, cameras:false, satellites:false}`, world-view zoom; `cameras` = `{cameras:true, ...}` + `liveOnly:true`, London view; `orbital` = `{satellites:true, planes:false, cameras:false}`, zoomed-out globe.

**Store wiring (reuse, don't replace):** add a `variantStore` (same `useSyncExternalStore` pattern as `lib/layers.ts`/`lib/overlay.ts`) holding the active slug. On boot, `applyVariant(config)` seeds the existing stores: `layersStore.set(...)`, `cameraFilterStore.setLiveOnly/...`, and pushes `accent` to a CSS var on `<html>`. No store schema changes — variants just call existing setters, so all current toggles keep working (user overrides persist for the session).

**Routing (subdomains):** add `middleware.ts` that reads `req.headers.host`, maps the leftmost label to a slug, and rewrites to `/?v=<slug>` (default host → `world`). `app/page.tsx` (client) reads `?v=` via `useSearchParams`, looks up `VARIANTS[slug]`, and calls `applyVariant` before `GlobeView` mounts. Vercel: add the wildcard/variant domains in project settings (free). Local dev falls back to `?v=` only.

**Files to ADD:** `lib/variants.ts`, `middleware.ts`, `components/VariantSwitcher.tsx` (top-bar pill menu, also a `Ctrl/Cmd-K` command-palette section). **CHANGE:** `app/page.tsx` (apply variant on mount), `app/layout.tsx` (read `--accent`), `components/LayerControl.tsx` + `globals.css` (consume `--accent` instead of hard-coded cyan).

**UX/states:** instant render — `applyVariant` runs synchronously from a static config, so there is no loading state. Empty layer (e.g. orbital before TLEs load) shows the existing "0" count, not an error. Unknown subdomain/slug → fall back to `world` (never a 404). Switcher is keyboard-navigable; selecting a variant updates the URL (`history.replaceState`) so it's shareable. `prefers-reduced-motion` respected by the existing globe.

**SSRF/proxy:** unchanged. Variants touch only layer defaults; every image/HLS fetch still goes through the closed `/api/proxy` and `/api/hls` allowlists. No new outbound origins, no raw `streamUrl` exposure.

## 5. Dependencies & prerequisites
- The single-MapLibre engine rebuild (globe projection) must be the active render path.
- Existing stores: `lib/layers.ts`, `lib/cameraFilter.ts`, `lib/overlay.ts`, `lib/world.ts` (all present).
- Command palette feature (if separate PRD) to host the variant section; otherwise the switcher pill ships standalone.
- No new npm deps.

## 6. Risks & mitigations
- **Subdomain config drift / cost:** Vercel custom domains are free but each must be added; document the list in `lib/variants.ts` as the single source. Local/preview always works via `?v=`.
- **User override vs preset confusion:** preset only seeds defaults once on load; a "Reset to <variant>" affordance re-applies. Document that toggles persist per session.
- **Performance:** variants that disable heavy layers (e.g. cameras off in orbital) *reduce* marker load — net win. No extra render cost; same single globe.
- **CORS/ToS:** none new — feeds and proxies unchanged.
- **SEO/duplicate content across subdomains:** add per-variant `<title>`/meta via `generateMetadata` keyed on host; low priority.

## 7. Acceptance criteria
- [ ] `lib/variants.ts` exports ≥4 transport variants (world, aviation, maritime-or-cameras, orbital) with distinct layer defaults + accents.
- [ ] Visiting `?v=aviation` loads with only the plane layer on and the aviation accent applied to the legend/UI.
- [ ] `middleware.ts` maps a variant subdomain to the right slug; unknown host falls back to `world` (no 404).
- [ ] Switching variants in `VariantSwitcher` updates layers, accent, and the shareable URL without a full reload.
- [ ] User toggles after load are preserved (preset does not re-override on every render).
- [ ] No new outbound origins; all media still routed through `/api/proxy` and `/api/hls`.
- [ ] Cold load renders the variant's first frame within seconds (no added loading spinner).

## 8. Out of scope / future
- Maritime ship/AIS layer, airport/NOTAM layer, chokepoint overlays — separate layer PRDs; variant configs just reference the `LayerKey`s once they exist.
- Per-variant saved user preferences / accounts (keyless, no-signup constraint).
- Per-variant curated "feed list" panels beyond layer toggles.
- Theming beyond a single accent token (full per-variant palettes).
