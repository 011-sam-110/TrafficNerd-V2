# PRD: Maritime AIS vessel tracking
> Priority: P1 · Effort: M · Status: Proposed · Category: data-layer

## 1. Summary
Add a fourth live layer — ships — to TrafficNerd v2 alongside cameras, aircraft and satellites. A new `ais` SourceAdapter pulls live vessel positions from a **keyless** AIS feed, classifies each vessel by ship type, normalizes it to the shared `WorldObject` shape, and exposes it via `/api/ships`. Vessels render on the same single MapLibre globe instance as the other layers, with a left-rail toggle + live count, and a right-side dossier panel (name, MMSI, type, destination, speed, nav status) on click. Static port markers give geographic context.

## 2. Why it matters for TrafficNerd
Ships are the one transport mode TrafficNerd doesn't yet show. Maritime is the backbone of global freight, and AIS gives the same "watch the world move in real time" payoff as planes — but slower, denser near coasts and ports, and visually distinct. It rounds out the "everything that moves" pitch (road cams + air + space + sea) and is a clean portfolio demonstration of the adapter pattern: a genuinely different domain folded into the existing contract with zero changes to the render engine.

## 3. worldmonitor.app reference
worldmonitor ships a "Ships (AIS): Live vessel tracking via AIS" layer sourced from **AISStream**, monitoring 62 strategic ports, with vessels rendered together with the other live layers on page load. We emulate the *experience* (ships as a first-class always-on layer with port context) but **not the source**: AISStream requires an API key, which violates our keyless constraint.

## 4. How we build it (TrafficNerd-specific)

### Data source (keyless)
Use **Digitraffic Marine AIS** (`meri.digitraffic.fi`) — fully keyless, same provider family we already trust for Finland cameras (`lib/sources/digitraffic.ts`), covering the Baltic. Two endpoints, merged by MMSI:
- `GET https://meri.digitraffic.fi/api/ais/v1/locations` — GeoJSON of latest positions (`mmsi`, `lon`/`lat`, `sog`, `cog`, `heading`, `navStat`, `timestamp`).
- `GET https://meri.digitraffic.fi/api/ais/v1/vessels` — metadata (`mmsi`, `name`, `shipType`, `callSign`, `destination`, `draught`, dimensions).

Send the politeness header `Digitraffic-User: trafficnerd/lesttech` (free, not auth). All fetching is **server-side only** in the route — the client never sees a raw upstream URL.

### Files to ADD
- `lib/sources/ais.ts` — `fetchVessels(now)`: fetch both endpoints with `AbortSignal.timeout`, left-join locations→vessels by MMSI, classify, return `WorldObject[]`; in-process cache + stale fallback (mirror `lib/sources/adsb.ts`).
- `lib/ships/classify.ts` — pure `classifyShip(shipType: number)` → `"cargo" | "tanker" | "passenger" | "fishing" | "pleasure" | "tug" | "other"` (AIS code bands: 70–79 cargo, 80–89 tanker, 60–69 passenger, 30 fishing, 36/37 sailing/pleasure, 31/32/52 tug). Unit-tested.
- `lib/ships/ports.ts` — static `PORTS` array (Helsinki, Turku, Kotka, Stockholm, Tallinn, Gdansk…) as labelled context markers.
- `lib/ships/useShips.ts` — client store polling `/api/ships` every ~15s, keep-last-good on error (mirror `lib/planes/usePlanes.ts`).
- `app/api/ships/route.ts` — `export const dynamic = "force-dynamic"`; `GET` → `{ count, ships }`, never throws.
- `lib/ships/classify.test.ts` — code-band assertions.

### Files to CHANGE
- `lib/world.ts` — extend `WorldObjectKind` with `"ship"`; doc `altKm: 0`, `heading` = `heading ?? cog`, `meta: { mmsi, callSign, destination, sog, navStatus, shipType }`.
- `lib/icons/svg.ts` — add `ship-cargo|tanker|passenger|fishing|pleasure|tug|other` IconKeys + `SHIP_META` palette.
- `lib/layers.ts` — add `"ships"` to `LayerKey`/`LayerState` (default `true`).
- `lib/overlay-content.tsx` — register a `case "ship"` → `ShipDetail` dossier (name, MMSI, flag from MMSI MID, type, destination, speed in kn, nav status). No external link, no photo.
- `lib/sources/registry.ts` *(or a ship registry if kept separate)* and `GlobeView` — surface ships through the same generic `WorldObject` render path; `<LayerControl>` already maps over `LayerKey`.

### UX
Always-on by default. Hover = label; click = right dossier. Loading = layer count shows `—`; empty (out of Baltic coverage) = greyed legend row with tooltip "Live AIS: Baltic Sea (keyless)"; error = keep last good silently. Command palette (Ctrl/Cmd-K) gains a "Toggle Ships" action.

### SSRF/proxy
No new client cross-origin calls and no `streamUrl` — vessels are pure JSON fetched server-side. No image/HLS proxy needed. If a vessel photo is added later it must go through `/api/proxy` with a host added to `lib/proxy/allowlist.ts`.

## 5. Dependencies & prerequisites
- No new npm deps. Reuses `zod`, the `WorldObject` contract, the icon sprite pipeline, and `useSyncExternalStore`.
- Soft-depends on the existing layer-rail + dossier shell and the icon set (single source of truth).

## 6. Risks & mitigations
- **Coverage is regional (Baltic), not global** — set honest expectations in the legend tooltip; design `fetchVessels` as a multi-source merge (`Promise.allSettled`) so a Norwegian Kystverket / other keyless feed can be added later without refactor.
- **Density near ports** — cap returned vessels and apply MapLibre symbol declutter (`icon-allow-overlap:false`) + zoom-gated visibility.
- **Rate/ToS** — Digitraffic is open but expects the `Digitraffic-User` header and reasonable polling; 15s server-cached fetch respects this.
- **MMSI without metadata** — render with type "other" rather than dropping.

## 7. Acceptance criteria
- [ ] `GET /api/ships` returns `{ count, ships: WorldObject[] }` with `kind:"ship"`, valid lat/lon, heading, and `meta.mmsi`; never 500s.
- [ ] All vessel data is fetched server-side; no upstream URL or stream reaches the client.
- [ ] Ships render on the globe with ship-type icons and orient to heading; layer toggle + live count work.
- [ ] Clicking a vessel opens a dossier with name, MMSI, type, destination, speed, nav status.
- [ ] `classifyShip` unit tests pass for every AIS code band; `npm run build` + lint clean.
- [ ] Solo-attributed commit (no Claude trailer).

## 8. Out of scope / future
Global coverage / additional keyless feeds; historical tracks & vessel breadcrumb trails; per-port arrival/departure boards; vessel photos; collision/anomaly detection; WebSocket/MQTT realtime push (`wss://meri.digitraffic.fi/mqtt`).
