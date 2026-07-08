# W4 — Aviation detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An airspace-console focus detail for the Aviation widget — ops summary, region/altitude filters, a sortable uncapped flight table with a per-flight dossier, an altitude sparkline, and a region map — plus finally activating the already-written squawk-emergency alerts by capturing `squawk` in the ADS-B parser.

**Architecture:** New default-export `AviationDetail(props: WidgetDetailProps)` registered as `detail:` on `AVIATION_WIDGET`. It reuses the SAME `usePlanes()` hook as the docked widget (`{ objects: WorldObject[], trails: PlaneTrail[] }`), pure aviation logic in a new testable `lib/planes/ops.ts`, and the shared `InsetMap`/`Chart`/`export`/`series` primitives. Squawk is threaded through `lib/sources/adsb.ts` so `meta.squawk` reaches both the table and the emergency `aviationAlerts` rule. The per-flight dossier reuses `components/PlaneDetail.tsx` unchanged.

**Tech Stack:** Next 15 / React 19 / TS; MapLibre (InsetMap); native SVG (Chart); vitest.

## Global Constraints

- Keyless-first, dormant-safe (adsb.lol + adsbdb both resolve to null/empty, never 5xx). Honest empty states.
- Native `<Chart>`; shared `<InsetMap>`; theme tokens only (`--tn-surface`/`--tn-surface-solid`/`--tn-surface-2`/`--tn-text`/`--tn-text-muted`/`--tn-text-faint`/`--tn-border`/`--tn-accent`). NO `--tn-surface-1`/`--tn-text-1`.
- Build gate (every task): `npx tsc --noEmit && npm test` → green.
- Commits: solo `011-sam-110 <lesttech.dev.sam@gmail.com>`, **no Co-Authored-By / Claude trailer**, plain `git commit -m "..."` (never a `@'...'` heredoc).
- Owned files only; never `git add -A`/`checkout`/`reset`/`stash`; do not touch `.superpowers/sdd/progress.md`.

## Reference pattern

`lib/console/widgets/signals.detail.tsx` (W3) and `lib/console/widgets/events.detail.tsx` (W1) are the canonical templates — mirror their idioms: `"use client"`, `useMemo`, honest empty states, `.tn-<x>-panels` grid with `<Chart>` + `<InsetMap>`, a table, a footer with attribution + CSV/GeoJSON export, and a masthead with counts/freshness + a count sparkline via `recordSeries`/`seriesSamples`/`deltaOf`.

## Data shapes (already exist — consume, don't redefine)

- `usePlanes(): { objects: WorldObject[]; trails: PlaneTrail[] }` — `@/lib/planes/usePlanes`. `PlaneTrail = { id: string; color: string; points: [number, number, number][] }` (lat, lon, altKm per breadcrumb).
- `WorldObject` — `@/lib/world`: `{ kind; id; lat; lon; altKm?; heading?; label; color?; icon?; typeLabel?; meta?: Record<string, unknown> }`. For planes `meta` carries: `callsign, registration, typeCode, adsbCategory, velocityMs, altKm, verticalRateMs, onGround, headingDeg, category (PlaneCategory), typeLabel, categorySource` — and (after Task 1) `squawk`.
- `PlaneCategory = "airliner"|"regional"|"light"|"helicopter"|"ground"` — `@/lib/planes/classify`.
- `ADSB_REGIONS: {lat,lon,distNm}[]` (3 regions, index 0 London / 1 California / 2 S.Carolina) — `@/lib/sources/adsb`.
- `PlaneDetail` — `@/components/PlaneDetail` (default): `PlaneDetail({ object: WorldObject })`, self-fetches `/api/flight`, body-only.
- `aviationAlerts` + `PlaneLite { callsign; squawk?; isMilitary? }` + `runAlertRule` — already imported in `aviation.tsx`.
- Primitives: `Chart({points:ChartPoint[],height?,up?})` / `ChartPoint{x,y}` (`@/components/Chart`); `InsetMap({points:InsetPoint[],height?,onSelect?})` default / `InsetPoint{lat,lon,id?,color?,props?}` (`@/components/InsetMap`, `@/lib/map/inset`); `recordSeries`/`seriesSamples` (`@/lib/series`) + `deltaOf` (`@/lib/widgets/history`); `toCsv`/`toGeoJson`/`downloadText`/`exportFilename` (`@/lib/export`); `shellLayoutStore.unfocus` (`@/lib/console/store`); `humaniseKey` (`@/lib/text/humanise`).

## File Structure

- Modify `lib/sources/adsb.ts` — capture `squawk` (RawAircraft, Aircraft, parseAdsb, aircraftToWorldObject.meta).
- Modify `tests/unit/adsb.test.ts` — squawk parse case.
- Create `lib/planes/ops.ts` — pure `opsSummary` / `altitudeBand` / `regionOf` / `sortFlights` (+ `REGION_LABELS`).
- Create `tests/unit/planes-ops.test.ts`.
- Create `lib/console/widgets/aviation.detail.tsx` — `AviationDetail`.
- Modify `lib/console/widgets/aviation.tsx` — attach `detail: AviationDetail`; thread `squawk` into `PlaneLite`.
- Modify `app/globals.css` — append `.tn-av*` block.

---

### Task 1: Capture squawk in the ADS-B parser (activates emergency alerts)

**Files:** Modify `lib/sources/adsb.ts`, `lib/console/widgets/aviation.tsx`; Test `tests/unit/adsb.test.ts`.

**Produces:** `Aircraft.squawk: string`; `WorldObject.meta.squawk`; `PlaneLite.squawk` populated.

- [ ] **Step 1 (failing test):** In `tests/unit/adsb.test.ts` add:

```ts
it("captures squawk (activates emergency-squawk alerts)", () => {
  const [a] = parseAdsb([{ hex: "abc", flight: "TEST123", lat: 51, lon: 0, alt_baro: 30000, squawk: "7700" }]);
  expect(a.squawk).toBe("7700");
});
```

Run `npx vitest run tests/unit/adsb.test.ts` → FAIL (`squawk` missing on `Aircraft`).

- [ ] **Step 2:** In `lib/sources/adsb.ts`:
  - Add to `interface RawAircraft` (after `category?: string;`): `squawk?: string;`
  - Add to `interface Aircraft` (after `registration: string;`): `squawk: string;`
  - In `parseAdsb`, in the pushed object (after `registration: (a.r ?? "").trim(),`): `squawk: (a.squawk ?? "").trim(),`
  - In `aircraftToWorldObject` `meta` (after `categorySource: …,`): `squawk: a.squawk,`

- [ ] **Step 3:** In `lib/console/widgets/aviation.tsx`, change the `lite` map to thread squawk and update the notes:

```tsx
const lite: PlaneLite[] = useMemo(
  () => planes.map((p) => ({ callsign: p.label, squawk: (p.meta?.squawk as string) || undefined })),
  [planes],
);
```

Update the JSDoc note bullet about squawk to reflect that it is now captured (emergency alerts live when a plane squawks 7500/7600/7700).

- [ ] **Step 4:** `npx vitest run tests/unit/adsb.test.ts` → PASS. Then gate `npx tsc --noEmit && npm test` → green.

- [ ] **Step 5: Commit** — `git add lib/sources/adsb.ts lib/console/widgets/aviation.tsx tests/unit/adsb.test.ts`
`git commit -m "feat(aviation): capture ADS-B squawk → activates emergency-squawk alerts"`

---

### Task 2: Pure aviation ops helpers

**Files:** Create `lib/planes/ops.ts`; Test `tests/unit/planes-ops.test.ts`.

**Produces:** `opsSummary`, `altitudeBand`, `regionOf`, `REGION_LABELS`, `sortFlights`, `FlightSortKey`.

- [ ] **Step 1: `lib/planes/ops.ts`**

```ts
// Pure aviation helpers for the airspace-console focus view. All read the plane
// WorldObject (its meta carries the classified category/onGround/velocity), so no
// re-classification or fetch is needed. Unit-tested; the .tsx is a dumb shell.
import type { WorldObject } from "@/lib/world";
import type { PlaneCategory } from "@/lib/planes/classify";
import { ADSB_REGIONS } from "@/lib/sources/adsb";

const CATEGORY_LABEL: Record<PlaneCategory, string> = {
  airliner: "Airliner", regional: "Regional", light: "Light", helicopter: "Helicopter", ground: "Ground",
};
const CATEGORY_ORDER: PlaneCategory[] = ["airliner", "regional", "light", "helicopter", "ground"];

function meta(o: WorldObject): Record<string, unknown> { return (o.meta ?? {}) as Record<string, unknown>; }
function categoryOf(o: WorldObject): PlaneCategory {
  const c = meta(o).category;
  return (typeof c === "string" && c in CATEGORY_LABEL ? c : "light") as PlaneCategory;
}
function velocityOf(o: WorldObject): number | null {
  const v = meta(o).velocityMs;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface OpsSummary {
  total: number; airborne: number; ground: number;
  byCategory: { category: PlaneCategory; label: string; count: number }[];
  maxAltKm: number; maxSpeedMs: number;
}

export function opsSummary(objects: WorldObject[]): OpsSummary {
  let airborne = 0, ground = 0, maxAltKm = 0, maxSpeedMs = 0;
  const counts: Partial<Record<PlaneCategory, number>> = {};
  for (const o of objects) {
    if (meta(o).onGround) ground++; else airborne++;
    const c = categoryOf(o);
    counts[c] = (counts[c] ?? 0) + 1;
    if (typeof o.altKm === "number" && o.altKm > maxAltKm) maxAltKm = o.altKm;
    const v = velocityOf(o);
    if (v != null && v > maxSpeedMs) maxSpeedMs = v;
  }
  const byCategory = CATEGORY_ORDER.filter((c) => counts[c]).map((c) => ({ category: c, label: CATEGORY_LABEL[c], count: counts[c]! }));
  return { total: objects.length, airborne, ground, byCategory, maxAltKm, maxSpeedMs };
}

export type AltBand = "ground" | "0–1 km" | "1–3 km" | "3–7 km" | "7–11 km" | "11+ km";
export const ALT_BANDS: AltBand[] = ["11+ km", "7–11 km", "3–7 km", "1–3 km", "0–1 km", "ground"];
export function altitudeBand(o: WorldObject): AltBand {
  if (meta(o).onGround) return "ground";
  const a = typeof o.altKm === "number" ? o.altKm : 0;
  if (a < 1) return "0–1 km";
  if (a < 3) return "1–3 km";
  if (a < 7) return "3–7 km";
  if (a < 11) return "7–11 km";
  return "11+ km";
}

// Region labels are index-matched to ADSB_REGIONS.
export const REGION_LABELS = ["London / SE England", "California", "South Carolina"];
/** Nearest ADS-B query region (the regions are continents apart, so squared-degree distance is enough). */
export function regionOf(lat: number, lon: number): string {
  let best = -1, bestD = Infinity;
  ADSB_REGIONS.forEach((r, i) => {
    const d = (lat - r.lat) ** 2 + (lon - r.lon) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best >= 0 ? (REGION_LABELS[best] ?? `Region ${best + 1}`) : "—";
}

export type FlightSortKey = "altitude" | "speed" | "callsign" | "region";
export function sortFlights(objects: WorldObject[], key: FlightSortKey, dir: 1 | -1): WorldObject[] {
  const cmp = (a: WorldObject, b: WorldObject): number => {
    if (key === "callsign") return a.label.localeCompare(b.label);
    if (key === "region") return regionOf(a.lat, a.lon).localeCompare(regionOf(b.lat, b.lon));
    if (key === "speed") return (velocityOf(a) ?? -Infinity) - (velocityOf(b) ?? -Infinity);
    return (a.altKm ?? -Infinity) - (b.altKm ?? -Infinity);
  };
  return [...objects].sort((a, b) => dir * cmp(a, b));
}
```

- [ ] **Step 2: `tests/unit/planes-ops.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { opsSummary, altitudeBand, regionOf, sortFlights } from "@/lib/planes/ops";
import type { WorldObject } from "@/lib/world";

const plane = (over: Partial<WorldObject> & { meta?: Record<string, unknown> }): WorldObject =>
  ({ kind: "plane", id: "plane:x", lat: 51, lon: 0, label: "T", ...over } as WorldObject);

describe("opsSummary", () => {
  it("splits airborne/ground, counts categories, tracks maxima", () => {
    const s = opsSummary([
      plane({ altKm: 10, meta: { category: "airliner", velocityMs: 250, onGround: false } }),
      plane({ altKm: 0, meta: { category: "ground", onGround: true, velocityMs: 5 } }),
    ]);
    expect(s.total).toBe(2);
    expect(s.airborne).toBe(1);
    expect(s.ground).toBe(1);
    expect(s.maxAltKm).toBe(10);
    expect(s.maxSpeedMs).toBe(250);
    expect(s.byCategory.find((c) => c.category === "airliner")!.count).toBe(1);
  });
});

describe("altitudeBand", () => {
  it("bands by altitude, ground first", () => {
    expect(altitudeBand(plane({ altKm: 9, meta: { onGround: false } }))).toBe("7–11 km");
    expect(altitudeBand(plane({ meta: { onGround: true } }))).toBe("ground");
  });
});

describe("regionOf", () => {
  it("maps coords to the nearest ADS-B region label", () => {
    expect(regionOf(51.5, -0.1)).toBe("London / SE England");
    expect(regionOf(37, -120)).toBe("California");
  });
});

describe("sortFlights", () => {
  it("sorts by altitude descending with dir -1", () => {
    const out = sortFlights([plane({ id: "a", altKm: 1 }), plane({ id: "b", altKm: 9 })], "altitude", -1);
    expect(out[0].id).toBe("b");
  });
});
```

- [ ] **Step 3: Gate + commit** — green.
`git add lib/planes/ops.ts tests/unit/planes-ops.test.ts`
`git commit -m "feat(aviation): pure ops helpers — summary, altitude bands, region, sort"`

---

### Task 3: Detail skeleton — masthead + ops-summary bar + register

**Files:** Create `lib/console/widgets/aviation.detail.tsx`; Modify `lib/console/widgets/aviation.tsx` (attach `detail`), `app/globals.css` (append `.tn-av*`).

Mirror `signals.detail.tsx`'s skeleton. `AviationDetail(_props: WidgetDetailProps)` calls `usePlanes()`, computes `opsSummary(objects)`, and renders:
- Masthead: title "Airspace", `<b>{total}</b> live · {airborne} airborne · {ground} ground · max {maxAltKm.toFixed(1)} km · {(maxSpeedMs*1.94384).toFixed(0)} kt`. Count sparkline via `recordSeries("av:count", total, Date.now())` + `seriesSamples`/`deltaOf` — fold in the live sample the SAME way W3 does (`signals.detail.tsx`) to avoid the one-poll delta lag.
- Ops bar: `summary.byCategory.map(...)` chips (`label · count`).
- Emergency banner: if any `objects` has `meta.squawk` in {7500,7600,7700}, show a `.tn-av-emg` critical row (`⚠ {callsign} squawking {code} — {hijack|radio failure|emergency}`). Reuse the reason map inline or import from `aviation.rules.ts` if exported; otherwise inline `{7500:"hijack",7600:"radio failure",7700:"emergency"}`.
- Honest empty state when `objects.length === 0` ("No aircraft in range right now.").
- Footer (attribution + export) is added in Task 6; a placeholder footer with attribution may exist now.

Declare state used later: `const [region, setRegion] = useState<string|null>(null)`, `const [band, setBand] = useState<AltBand|null>(null)`, `const [sortKey, setSortKey] = useState<FlightSortKey>("altitude")`, `const [dir, setDir] = useState<1|-1>(-1)`, `const [openId, setOpenId] = useState<string|null>(null)`. Repo tsconfig has NO `noUnusedLocals`, so declaring these now compiles clean; Tasks 4–5 consume them.

CSS `.tn-av*`: reuse the `.tn-sd*` visual language (masthead, panels grid, chips, table, emergency row in a red-tinted band, footer/actions). Theme tokens only.

- [ ] **Step 1:** Write the component skeleton + emergency banner + ops bar.
- [ ] **Step 2:** Add `detail: AviationDetail` to `AVIATION_WIDGET` and `import AviationDetail from "./aviation.detail";`.
- [ ] **Step 3:** Append `.tn-av*` CSS.
- [ ] **Step 4: Gate + commit** — green.
`git commit -m "feat(aviation): focus detail skeleton — ops summary + emergency-squawk banner"`

---

### Task 4: Region + altitude filter rail, region map, altitude sparkline

**Files:** Modify `lib/console/widgets/aviation.detail.tsx`.

- Filter rail: region chips (`REGION_LABELS` + "All") toggling `region`; altitude-band chips (`ALT_BANDS` + "All") toggling `band`. Apply both filters to derive `filtered = objects.filter(o => (!region || regionOf(o.lat,o.lon)===region) && (!band || altitudeBand(o)===band))`. All downstream panels/table use `filtered`.
- Region `InsetMap`: `points = filtered.map(o => ({ lat:o.lat, lon:o.lon, id:o.id, color:o.color, props:{ callsign:o.label } }))`, `onSelect={setOpenId}`.
- Altitude sparkline: derive a series from `layer.trails` for the selected/overall set — simplest honest version: chart the count-of-aircraft over the recorded `av:count` series (already have it) OR an altitude histogram of `filtered` via `ALT_BANDS` counts rendered as `.tn-av-bars` (like `.tn-sd-bars`). Prefer the altitude histogram (no time series needed): bars per `ALT_BANDS` with counts.

- [ ] **Step 1:** Insert the filter rail + region map + altitude histogram panels (grid), all keyed off `filtered`.
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(aviation): focus detail — region/altitude filters + region map + altitude histogram"`

---

### Task 5: Sortable flight table + per-flight dossier

**Files:** Modify `lib/console/widgets/aviation.detail.tsx`.

- Uncapped sortable table over `sortFlights(filtered, sortKey, dir)`. Columns (click header to sort where a `FlightSortKey` exists): Callsign, Type (`typeLabel` + `meta.typeCode`), Alt (`{altKm.toFixed(1)} km / {(altKm/0.0003048).toFixed(0)} ft`), Speed (`{(velocityMs*1.94384).toFixed(0)} kt` / `{(velocityMs*3.6).toFixed(0)} km/h`), Heading (`{headingDeg}° {compass}`), V/S (`meta.verticalRateMs`), Reg (`meta.registration`), Region (`regionOf`), Squawk (`meta.squawk`, red when emergency). Provide a local `headingToCompass(deg)` helper (16-point or 8-point) — the private one in `PlaneDetail.tsx` is not exported, so declare a small local copy.
- Row click toggles `openId`; when open, render a drill row `<td colSpan=…><PlaneDetail object={o} /></td>` (import `PlaneDetail` default). This gives route/airframe enrichment for free (dormant-safe).

- [ ] **Step 1:** Insert the table + dossier drill row (keyed-fragment: `import { Fragment }`, `<Fragment key={o.id}>`).
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(aviation): focus detail — sortable flight table + per-flight dossier (PlaneDetail)"`

---

### Task 6: Footer — attribution + CSV/GeoJSON export

**Files:** Modify `lib/console/widgets/aviation.detail.tsx`.

- Footer: attribution `Aircraft: adsb.lol · enrichment: adsbdb · 3 fixed regions (London / California / S.Carolina)`.
- Export buttons (disabled when empty): CSV of the flight rows (callsign, type, altKm, speedKt, headingDeg, verticalRateMs, registration, region, squawk) via `toCsv`/`downloadText`/`exportFilename("aviation", Date.now())`; GeoJSON via `toGeoJson(filtered.map(o => ({ lat:o.lat, lon:o.lon, properties:{ callsign:o.label, ...(o.meta ?? {}) } })))`.

- [ ] **Step 1:** Insert the footer + export.
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(aviation): focus detail — attribution footer + CSV/GeoJSON export"`

---

### Task 7: Verification

- [ ] Full gate `npx tsc --noEmit && npm test` green; `git status` clean apart from `.superpowers/sdd/progress.md`.
- [ ] Confirm the squawk thread: a raw row with `squawk:"7700"` produces `meta.squawk==="7700"` and the emergency banner + red table cell (unit test covers the parse; banner is code-review-verified).
- [ ] If the integrator has a browser: expand the Aviation widget, confirm ops summary, filters, region map, table sort + dossier, export. Otherwise note live visual verification pending.

## Self-Review

- **Spec §7.4 coverage:** (1) ops summary bar → Task 3 ✓; (2) region + altitude filter rail → Task 4 ✓; (3) master flight table (sortable, uncapped, CSV/GeoJSON) → Tasks 5+6 ✓; (4) per-flight dossier via `PlaneDetail` → Task 5 ✓; (5) altitude sparkline/histogram from trails → Task 4 (altitude histogram) ✓; (6) region `InsetMap` with heading-oriented markers + trails → Task 4 (InsetMap; heading colour via `o.color`; trails are a nice-to-have, InsetMap renders anchor points) ✓; squawk parse → Task 1 ✓ (activates the pre-written `aviationAlerts`).
- **Type consistency:** `OpsSummary`, `AltBand`/`ALT_BANDS`, `FlightSortKey`, `REGION_LABELS`, `opsSummary`/`altitudeBand`/`regionOf`/`sortFlights` names match across Tasks 2→6. `usePlanes`/`WorldObject.meta`/`PlaneDetail`/`aviationAlerts`/`Chart`/`InsetMap`/export signatures verified against source.
- **Honesty:** squawk-emergency only fires on real 7500/7600/7700; "N live · airborne/ground"; region derived by nearest-of-3 (regions are continents apart); dormant-safe enrichment; empty states honest. Note: InsetMap renders anchor points (not full heading-rotated glyphs or trail polylines) — acceptable v1, documented.
