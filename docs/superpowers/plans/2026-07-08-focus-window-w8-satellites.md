# W8 — Satellites detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A satellite command console focus view (Option C = orbital detail AND imagery): full orbital vitals parsed from the TLE, a live ±1-period ground track, NASA GIBS true-color imagery beneath each satellite's sub-point, a searchable/sortable roster with a per-satellite dossier, and export.

**Architecture:** New default-export `SatellitesDetail(props: WidgetDetailProps)` registered as `detail:` on `SATELLITES_WIDGET`, reusing `useSatellites(group)`. Pure TLE-element parsing (`lib/satellites/elements.ts`), ground-track sampling with antimeridian split (`lib/satellites/groundTrack.ts`), and GIBS tile math (`lib/sources/gibs.ts`) are testable modules. `<InsetMap>` gains an OPTIONAL backward-compatible `track` line layer. The dossier reuses `components/SatelliteDetail.tsx` and adds the GIBS sub-point tile alongside its existing Esri close-up.

**Tech Stack:** Next 15 / React 19 / TS; satellite.js SGP4 (already a dep, via `lib/satellites/propagate.ts`); MapLibre (InsetMap); NASA GIBS (keyless WMTS tiles); vitest.

## Global Constraints

- Keyless throughout (CelesTrak TLEs, GIBS imagery, Esri imagery — all already keyless or new-keyless). Dormant-safe; honest empty states.
- **Honesty (critical for imagery):** GIBS shows NASA true-color of the REGION BENEATH the sub-point for a DATE (yesterday, for full coverage) — caption it exactly that. NEVER imply it is a live photo taken by that satellite.
- The `<InsetMap>` change MUST be backward-compatible: `track` is optional; when absent, every existing caller (events/signals/aviation/cameras details) renders identically. Grep-verify.
- Native primitives; theme tokens only (`--tn-surface`/`--tn-surface-solid`/`--tn-surface-2`/`--tn-text`/`--tn-text-muted`/`--tn-text-faint`/`--tn-border`/`--tn-accent`). NO `--tn-surface-1`/`--tn-text-1`.
- Build gate (every task): `npx tsc --noEmit && npm test` → green.
- Commits: solo `011-sam-110 <lesttech.dev.sam@gmail.com>`, **no Co-Authored-By / Claude trailer**, plain `git commit -m "..."`.
- Owned files only; never `git add -A`/`checkout`/`reset`/`stash`; do not touch `.superpowers/sdd/progress.md`.
- **Verify signatures against source** first: `useSatellites`, `WorldObject.meta` fields, `lib/satellites/propagate.ts` (how to build a satrec from `line1`/`line2` + `propagateAt`), `components/SatelliteDetail.tsx` props, `components/InsetMap.tsx` internals, `lib/satellites/classify.ts`.

## Reference pattern

`lib/console/widgets/aviation.detail.tsx` / `signals.detail.tsx` for the detail skeleton (masthead + sparkline with the W4 "only stamp once real data arrives" fix, panels grid, table, footer, export). `components/InsetMap.tsx` for how a MapLibre source/layer is added (add the line layer the same way the circle layer is added).

## Data shapes (verify, then consume)

- `useSatellites(group = "visual", stepMs = 1000): WorldObject[]` — `lib/satellites/useSatellites.ts`. Objects: `{ kind:"satellite", id:"sat:<norad>", lat, lon, altKm, label, color, icon, typeLabel, meta:{ noradId, objectName, line1, line2, altKm, velocityKmS, periodMin, typeLabel } }`.
- `lib/satellites/propagate.ts`: a satrec builder from a TLE (confirm the export — likely `satellite.twoline2satrec(line1, line2)` re-exported or an internal helper) + `propagateAt(satrec, date: Date): { lat, lon, altKm, velocityKmS }`.
- `components/SatelliteDetail.tsx` (default): `SatelliteDetail({ object: WorldObject })` — renders Esri sub-point imagery + a vitals `<dl>`.
- `SATELLITES_WIDGET` — plain object in `lib/console/widgets/satellites.tsx`, `registerWidget(...)`. Attach `detail: SatellitesDetail` + `capabilities: { filter: true, sort: true }`.
- `InsetMap({ points, height?, onSelect? })` — extend with optional `track`.
- Primitives: `Chart`, `recordSeries`/`seriesSamples`/`deltaOf`, `toCsv`/`toGeoJson`/`downloadText`/`exportFilename`, `shellLayoutStore.unfocus`, `humaniseKey`.

## File Structure

- Create `lib/satellites/elements.ts`, `lib/satellites/groundTrack.ts`, `lib/sources/gibs.ts`, `lib/console/widgets/satellites.detail.tsx`.
- Create tests `tests/unit/satellite-elements.test.ts`, `tests/unit/ground-track.test.ts`, `tests/unit/gibs.test.ts`.
- Modify `components/InsetMap.tsx` (optional `track`), `lib/console/widgets/satellites.tsx` (attach `detail:` + capabilities), `app/globals.css` (`.tn-sat*`).

---

### Task 1: Pure TLE orbital-element parsing

**Files:** Create `lib/satellites/elements.ts`; Test `tests/unit/satellite-elements.test.ts`.

- [ ] **Step 1: `lib/satellites/elements.ts`** — parse the fixed-column TLE format (1-indexed columns per the TLE spec) and derive apogee/perigee.

```ts
// Pure TLE (two-line element) parsing → the orbital vitals the console shows.
// Fixed-column format (1-indexed cols per the NORAD spec); eccentricity has an
// implied leading decimal. Derived apogee/perigee from mean motion + eccentricity.
export interface OrbitalElements {
  inclinationDeg: number;
  raanDeg: number;          // right ascension of the ascending node
  eccentricity: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
  periodMin: number;
  semiMajorAxisKm: number;
  apogeeKm: number;         // above Earth's surface
  perigeeKm: number;
}

const GM_EARTH = 398600.4418; // km^3 / s^2
const R_EARTH = 6378.137;     // km (equatorial)

function n(s: string): number { const v = Number(s.trim()); return Number.isFinite(v) ? v : 0; }

/** Parse TLE line 2 into orbital elements (line 1 gives epoch/drag, not needed here). */
export function parseElements(line1: string, line2: string): OrbitalElements | null {
  if (!line2 || line2.length < 63 || line2[0] !== "2") return null;
  const inclinationDeg = n(line2.slice(8, 16));
  const raanDeg = n(line2.slice(17, 25));
  const eccentricity = n(`0.${line2.slice(26, 33).trim()}`); // implied leading "0."
  const argPerigeeDeg = n(line2.slice(34, 42));
  const meanAnomalyDeg = n(line2.slice(43, 51));
  const meanMotionRevPerDay = n(line2.slice(52, 63));
  const periodMin = meanMotionRevPerDay > 0 ? 1440 / meanMotionRevPerDay : 0;
  const nRadPerSec = (meanMotionRevPerDay * 2 * Math.PI) / 86400;
  const semiMajorAxisKm = nRadPerSec > 0 ? Math.cbrt(GM_EARTH / (nRadPerSec * nRadPerSec)) : 0;
  const apogeeKm = semiMajorAxisKm * (1 + eccentricity) - R_EARTH;
  const perigeeKm = semiMajorAxisKm * (1 - eccentricity) - R_EARTH;
  return { inclinationDeg, raanDeg, eccentricity, argPerigeeDeg, meanAnomalyDeg, meanMotionRevPerDay, periodMin, semiMajorAxisKm, apogeeKm, perigeeKm };
}
```

- [ ] **Step 2: `tests/unit/satellite-elements.test.ts`** (ISS TLE — stable reference values):

```ts
import { describe, it, expect } from "vitest";
import { parseElements } from "@/lib/satellites/elements";

// A real ISS (ZARYA) TLE. Mean motion ~15.5 rev/day → ~92-93 min, LEO ~400-420 km.
const L1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005";
const L2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377579  1234";

describe("parseElements", () => {
  it("parses inclination / eccentricity / mean motion and derives period + apogee/perigee", () => {
    const e = parseElements(L1, L2)!;
    expect(e).not.toBeNull();
    expect(Math.round(e.inclinationDeg * 10) / 10).toBe(51.6);
    expect(e.eccentricity).toBeCloseTo(0.0006703, 6);
    expect(Math.round(e.meanMotionRevPerDay)).toBe(16); // ~15.5 → rounds to 16
    expect(Math.round(e.periodMin)).toBe(93);           // 1440 / 15.50 ≈ 92.9
    expect(e.perigeeKm).toBeGreaterThan(380);
    expect(e.apogeeKm).toBeLessThan(430);
  });
  it("returns null on a malformed line", () => {
    expect(parseElements("", "garbage")).toBeNull();
  });
});
```

> If the test's rounded expectations are slightly off from the real column slicing, ADJUST the expected numbers to the actual parsed values (the column offsets are the source of truth) — do NOT loosen them to meaninglessness. Keep inclination ≈ 51.6 and period ≈ 93 as the anchors.

- [ ] **Step 3: Gate + commit** — green.
`git add lib/satellites/elements.ts tests/unit/satellite-elements.test.ts`
`git commit -m "feat(satellites): pure TLE orbital-element parsing + apogee/perigee derivation"`

---

### Task 2: GIBS tile math (keyless imagery by sub-point)

**Files:** Create `lib/sources/gibs.ts`; Test `tests/unit/gibs.test.ts`.

- [ ] **Step 1: `lib/sources/gibs.ts`**

```ts
// NASA GIBS keyless true-color imagery. We show the tile covering a satellite's
// sub-point for a date (default: yesterday UTC, which has full global coverage).
// Web-Mercator (EPSG:3857) slippy tiles — the same z/x/y scheme MapLibre/OSM use.
const LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
const MATRIX = "GoogleMapsCompatible_Level9";

/** lon/lat + zoom → slippy tile {x,y} (Web-Mercator). */
export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const nTiles = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * nTiles);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * nTiles);
  const clamp = (v: number) => Math.max(0, Math.min(nTiles - 1, v));
  return { x: clamp(x), y: clamp(y) };
}

/** UTC yesterday as YYYY-MM-DD (GIBS lags ~1 day; yesterday is reliably covered). */
export function gibsDate(nowMs: number): string {
  return new Date(nowMs - 24 * 3600_000).toISOString().slice(0, 10);
}

/** A keyless GIBS true-color tile URL covering (lat, lon) at zoom `z` for a date. */
export function gibsTileUrl(lat: number, lon: number, z: number, date: string): string {
  const { x, y } = lonLatToTile(lon, lat, z);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYER}/default/${date}/${MATRIX}/${z}/${y}/${x}.jpg`;
}
```

- [ ] **Step 2: `tests/unit/gibs.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { lonLatToTile, gibsTileUrl, gibsDate } from "@/lib/sources/gibs";

describe("gibs tile math", () => {
  it("maps (0,0) to the centre tile at each zoom", () => {
    expect(lonLatToTile(0, 0, 1)).toEqual({ x: 1, y: 1 });
    expect(lonLatToTile(-180, 85, 2)).toEqual({ x: 0, y: 0 });
  });
  it("clamps out-of-range into valid tile indices", () => {
    const t = lonLatToTile(200, -95, 1); // beyond bounds
    expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x).toBeLessThanOrEqual(1);
    expect(t.y).toBeGreaterThanOrEqual(0); expect(t.y).toBeLessThanOrEqual(1);
  });
  it("builds a keyless GIBS URL for a sub-point", () => {
    const url = gibsTileUrl(51.5, -0.1, 3, "2026-07-07");
    expect(url).toContain("gibs.earthdata.nasa.gov");
    expect(url).toContain("/2026-07-07/");
    expect(url).toMatch(/\/3\/\d+\/\d+\.jpg$/);
  });
  it("gibsDate is UTC yesterday", () => {
    expect(gibsDate(Date.parse("2026-07-08T00:00:00Z"))).toBe("2026-07-07");
  });
});
```

- [ ] **Step 3: Gate + commit** — green.
`git add lib/sources/gibs.ts tests/unit/gibs.test.ts`
`git commit -m "feat(satellites): keyless NASA GIBS true-color tile math (sub-point imagery)"`

---

### Task 3: Ground-track sampling with antimeridian split

**Files:** Create `lib/satellites/groundTrack.ts`; Test `tests/unit/ground-track.test.ts`. May reuse `propagate.ts` (satrec builder + `propagateAt`).

- [ ] **Step 1:** `lib/satellites/groundTrack.ts` — pure antimeridian split + a track builder.

```ts
// Pure: split a sequence of [lon, lat] points into segments wherever consecutive
// longitudes jump more than 180° (an antimeridian crossing), so a polyline renderer
// draws separate strokes instead of one horizontal streak across the whole map.
export function splitAntimeridian(points: [number, number][]): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i][0] - points[i - 1][0]) > 180) { segs.push(cur); cur = []; }
    cur.push(points[i]);
  }
  if (cur.length) segs.push(cur);
  return segs;
}
```

- [ ] **Step 2:** Add `groundTrack(line1, line2, atMs, periodMin, stepSec = 60): [number, number][][]` that builds a satrec from the TLE (reuse the `propagate.ts` builder — confirm its export; if none, use `satellite.twoline2satrec(line1, line2)` from the already-installed `satellite.js`), propagates `propagateAt(satrec, new Date(t))` across `[atMs − P/2, atMs + P/2]` at `stepSec`, collects `[lon, lat]`, and returns `splitAntimeridian(points)`. It MUST resolve to `[]` on any propagation error (dormant-safe; wrap in try/catch).

- [ ] **Step 3:** Test `tests/unit/ground-track.test.ts` — test `splitAntimeridian` purely (full SGP4 propagation is already covered by existing satellite tests; don't re-test satellite.js):

```ts
import { describe, it, expect } from "vitest";
import { splitAntimeridian } from "@/lib/satellites/groundTrack";

describe("splitAntimeridian", () => {
  it("splits at a dateline crossing", () => {
    const segs = splitAntimeridian([[170, 0], [179, 0], [-179, 0], [-170, 0]]);
    expect(segs.length).toBe(2);
    expect(segs[0].length).toBe(2);
    expect(segs[1].length).toBe(2);
  });
  it("keeps a non-crossing track as one segment", () => {
    expect(splitAntimeridian([[0, 0], [10, 5], [20, 10]]).length).toBe(1);
  });
});
```

- [ ] **Step 4: Gate + commit** — green.
`git add lib/satellites/groundTrack.ts tests/unit/ground-track.test.ts`
`git commit -m "feat(satellites): ±1-period ground-track sampling + antimeridian split"`

---

### Task 4: InsetMap optional track line (backward-compatible)

**Files:** Modify `components/InsetMap.tsx`.

- [ ] **Step 1:** Add an OPTIONAL prop `track?: [number, number][][]` (array of `[lon,lat]` segments). When present + non-empty, add a GeoJSON source + a `line` layer (a MultiLineString from the segments) the same way the existing circle source/layer is added; update it in the same effect that updates points; fit bounds to include the track. When `track` is undefined, behave EXACTLY as today. Style the line with a literal accent hex (consistent with how the circle layer uses literals).

- [ ] **Step 2:** Grep every existing `<InsetMap` caller (aviation/cameras/events/signals details) — confirm none passes `track`, so all render identically. Gate + commit.
`git add components/InsetMap.tsx`
`git commit -m "feat(map): InsetMap optional track polyline layer (backward-compatible)"`

---

### Task 5: Detail — command bar, roster, orbital vitals, ground-track map, GIBS imagery, dossier

**Files:** Create `lib/console/widgets/satellites.detail.tsx`; Modify `lib/console/widgets/satellites.tsx`, `app/globals.css`.

- [ ] **Step 1:** `SatellitesDetail(_props: WidgetDetailProps)` reusing `useSatellites(group)`:
  - Command bar: group fixed by the docked config (`config.group`); category chips with counts (from `classify.ts`/`meta.typeLabel`); a search box filtering the roster; count sparkline (`recordSeries("sat:count", n, tick)` — only stamp once objects arrive, per the W4 fix). Masthead shows count + "TLEs via CelesTrak · SGP4".
  - Selected satellite state: `const [selId, setSelId] = useState<string|null>(<first object id>)`; `const [q, setQ] = useState("")`.
  - Orbital vitals panel: `parseElements(meta.line1, meta.line2)` → a `<dl>` (inclination, ecc, RAAN, argP, mean anomaly, mean motion, period, apogee/perigee) using `humaniseKey`-style labels; plus live sub-point lat/lon/alt/velocity from the object.
  - Ground-track map: `<InsetMap points={[selected sub-point + neighbours]} track={groundTrack(meta.line1, meta.line2, Date.now(), meta.periodMin)} height={240} />`. Honest empty state if the track is `[]`.
  - GIBS imagery panel: `<img src={gibsTileUrl(sel.lat, sel.lon, 4, gibsDate(Date.now()))}>` captioned "NASA GIBS true-color · <date> · region beneath the sub-point (not a live satellite photo)". Optionally a second, higher-zoom tile.
  - Roster: searchable/sortable table (name, NORAD, category, altKm, periodMin) over the filtered objects; row click sets `selId`; drill row renders `<SatelliteDetail object={obj} />` (its Esri close-up complements the GIBS regional tile).
  - Optional live-feed note: for NORAD 25544 (ISS) show a keyless NASA ISS live YouTube embed; every other satellite shows "No public live feed" (honest).

- [ ] **Step 2:** Add `detail: SatellitesDetail` + `capabilities: { filter: true, sort: true }` + import to `SATELLITES_WIDGET` in `satellites.tsx`.

- [ ] **Step 3:** Append `.tn-sat*` CSS (masthead, chips, panels grid, vitals dl, imagery tile + caption, roster table, dossier row). Theme tokens only.

- [ ] **Step 4: Gate + commit** — green.
`git commit -m "feat(satellites): focus detail — orbital vitals + ground track + GIBS imagery + roster dossier"`

---

### Task 6: Footer — attribution + export

**Files:** Modify `lib/console/widgets/satellites.detail.tsx`.

- [ ] **Step 1:** Footer: attribution "TLEs: CelesTrak · propagation: SGP4 (satellite.js) · imagery: NASA GIBS + Esri World Imagery". Export (disabled when empty): CSV of the roster (name, norad, category, altKm, periodMin, lat, lon) and GeoJSON of the current sub-points via `toGeoJson(objects.map(o => ({ lat:o.lat, lon:o.lon, properties:{ name:o.label, norad:o.meta?.noradId } })))`, using `exportFilename("satellites", Date.now())`.

- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(satellites): focus detail — attribution footer + CSV/GeoJSON export"`

---

### Task 7: Verification

- [ ] Full gate `npx tsc --noEmit && npm test` green; `git status` clean apart from `.superpowers/sdd/progress.md`.
- [ ] Confirm the InsetMap `track` addition did not change any existing caller's render (grep + the full test suite).
- [ ] Confirm the GIBS caption never claims a live satellite photo; imagery is keyless.
- [ ] If the integrator has a browser: expand the Satellites widget, confirm vitals, a ground-track line on the map, a GIBS tile, roster search/sort + dossier, export. Otherwise note live visual verification pending.

## Self-Review

- **Spec §7.8 coverage:** (1) command bar (group/category/search + TLE-source honesty) → Task 5 ✓; (2) searchable/sortable roster → Task 5 ✓; (3) orbital vitals (incl/ecc/RAAN/argP/mean-anom/mean-motion + derived apogee/perigee) → Tasks 1+5 ✓; (4) live ground track on InsetMap (±1 period, antimeridian split) → Tasks 3+4+5 ✓; (5) next-pass/sky-chart → DEFERRED (needs geolocation + new math; spec-optional) — noted, not silently dropped; (6) region imagery (GIBS true-color + Esri close-up) → Tasks 2+5 ✓; (7) live feed only where it exists (ISS embed, else "no public feed") → Task 5 ✓.
- **Type consistency:** `parseElements`/`OrbitalElements`/`lonLatToTile`/`gibsTileUrl`/`gibsDate`/`splitAntimeridian`/`groundTrack` names match across Tasks 1→6; InsetMap `track` prop consistent.
- **Honesty:** GIBS captioned as regional true-color for a date, never a live satellite photo; apogee/perigee derived transparently; ground track resolves to [] on propagation error; deferred next-pass flagged, not hidden.
- **Risk flagged:** the ground track (Task 3) needs a satrec from the TLE — reuse `propagate.ts`'s builder if exported, else `satellite.twoline2satrec` directly; keep it dormant-safe ([] on error). The InsetMap change is the shared-component risk — keep `track` strictly optional + grep-verify callers (same discipline as the W7 Chart `zeroBaseline` change).
