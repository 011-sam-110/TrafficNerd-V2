# W5 — Cameras detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A traffic-camera console focus view — an honest coverage bar (live-HLS vs still vs offline, per operator), a region map, operator/region filters, still + live-HLS camera walls (concurrency-capped players), a sortable table with a per-camera dossier (live snapshot), and CSV/GeoJSON export.

**Architecture:** New default-export `CamerasDetail(props: WidgetDetailProps)` registered as `detail:` on `CAMERAS_WIDGET`. Because the docked widget only reads map-loaded cameras (`loadedCamerasStore`), the detail needs a NEW `useCameras()` hook that fetches the full `/api/cameras` list (enriched this milestone). Pure coverage + HLS-concurrency logic lives in testable `lib/cameras/coverage.ts` + `lib/cameras/concurrency.ts`. Snapshots are shown ONLY through the existing `/api/proxy?id=` (still) and `/api/hls?id=` (live) routes via the existing `CameraImage`/`CameraVideo`/`CameraDetail` components — never raw upstream URLs (SSRF). Region filtering reuses `cameraFilterStore`.

**Tech Stack:** Next 15 / React 19 / TS; MapLibre (InsetMap); hls.js (via existing CameraVideo); vitest.

## Global Constraints

- Keyless-first, dormant-safe; honest empty states. NEVER render an upstream camera URL directly — always `/api/proxy?id=<id>` (still) or `/api/hls?id=<id>` (live), which enforce the SSRF allowlist by id.
- Native `<Chart>`; shared `<InsetMap>`; theme tokens only (`--tn-surface`/`--tn-surface-solid`/`--tn-surface-2`/`--tn-text`/`--tn-text-muted`/`--tn-text-faint`/`--tn-border`/`--tn-accent`). NO `--tn-surface-1`/`--tn-text-1`.
- Cap concurrent live HLS players (CAP = 6) — a 50-player wall would kill the browser. Stills are cheap `<img>`; default everything to still, activate live on click.
- Build gate (every task): `npx tsc --noEmit && npm test` → green.
- Commits: solo `011-sam-110 <lesttech.dev.sam@gmail.com>`, **no Co-Authored-By / Claude trailer**, plain `git commit -m "..."` (never a `@'...'` heredoc).
- Owned files only; never `git add -A`/`checkout`/`reset`/`stash`; do not touch `.superpowers/sdd/progress.md`.
- **Verify every import path against source before use** — the interfaces below are from a research pass; confirm exact names/paths (esp. `Camera` type location, `isLiveStreamUrl`, `cameraFilterStore`, the proxy/hls routes) in the actual files.

## Reference pattern

`lib/console/widgets/aviation.detail.tsx` (W4) and `lib/console/widgets/signals.detail.tsx` (W3) are the canonical templates — mirror masthead+counts+sparkline (fold the live sample in, and **only stamp `updatedAt` once real data arrives** — the W4 review fix), `.tn-<x>-panels` grid, filter chips, footer with attribution + export.

## Data shapes (verify, then consume)

- `Camera` (`lib/types.ts`, `CameraSchema`): `{ id; source; country; region?; name; lat; lon; road?; direction?; imageUrl?; streamUrl?; mediaType:"jpeg"|"video"|"both"; refreshSeconds; license; attribution; available; lastSampledAt? }`. Derived `live = isLiveStreamUrl(streamUrl)` (`lib/proxy/hls-allowlist.ts`).
- `/api/cameras` currently returns only `{ id, name, lat, lon, available, source, country, live }` — **Task 1 enriches it** with `region, road, refreshSeconds, attribution, license, lastSampledAt`.
- `CAMERAS_WIDGET` — plain object in `lib/console/widgets/cameras.tsx`, `registerWidget(CAMERAS_WIDGET)`. Attach `detail: CamerasDetail`.
- `cameraFilterStore` + `useCameraFilter()` (`lib/cameraFilter.ts`): `{ regions: Record<source,boolean>; liveOnly: boolean }`, `toggleRegion(source)`, `setLiveOnly(on)`, `passes(source, live)`, `get`, `subscribe`.
- `components/CameraDetail.tsx` (default): `CameraDetail({ object: WorldObject })` — self-fetches `/api/camera/${id}`, renders `CameraVideo`/`CameraImage` + freshness + deep link. Build a minimal `WorldObject` (`{ kind:"camera", id, label:name, lat, lon, meta:{ available } }`) for the drill-down.
- `components/CameraImage.tsx` / `components/CameraVideo.tsx` (defaults): props `{ id, alt, attribution, license, refreshSeconds }`; render `/api/proxy?id=` / `/api/hls?id=`.
- `lib/cameras/freshness.ts` (pure): `msUntilRefresh`, `refreshProgress`, `formatCountdown`, `sampledAgeMs`.
- Primitives: `Chart`/`InsetMap`/`recordSeries`+`seriesSamples`/`deltaOf`/`toCsv`+`toGeoJson`+`downloadText`+`exportFilename`/`shellLayoutStore.unfocus`/`humaniseKey` (same imports as W3/W4).

## File Structure

- Create `lib/cameras/coverage.ts`, `lib/cameras/concurrency.ts`, `lib/cameras/useCameras.ts`, `lib/console/widgets/cameras.detail.tsx`.
- Create tests `tests/unit/cameras-coverage.test.ts`, `tests/unit/cameras-concurrency.test.ts`.
- Modify `app/api/cameras/route.ts` (enrich payload), `lib/console/widgets/cameras.tsx` (attach `detail:`), `app/globals.css` (`.tn-cm*`).

---

### Task 1: Enrich `/api/cameras` + pure coverage + HLS-concurrency helpers

**Files:** Modify `app/api/cameras/route.ts`; Create `lib/cameras/coverage.ts`, `lib/cameras/concurrency.ts`; Test `tests/unit/cameras-coverage.test.ts`, `tests/unit/cameras-concurrency.test.ts`.

- [ ] **Step 1: Enrich the route.** In `app/api/cameras/route.ts`, add `region, road, refreshSeconds, attribution, license, lastSampledAt` to each mapped camera object it returns (they already exist on the full record — just include them). Keep `live` and everything already returned. Do NOT leak `imageUrl`/`streamUrl` (snapshots go through the proxy by id). If a route-shape test exists, update it.

- [ ] **Step 2: `lib/cameras/coverage.ts`** (define a local minimal `CameraLite` shape so the helper is decoupled from the full zod type):

```ts
// Pure coverage/honesty maths for the Cameras focus view. A camera is offline when
// unavailable, "live" when it exposes an allowlisted HLS stream, else a refreshing
// still. Grouped per operator so the console can be honest about what each feed is.
export interface CameraLite {
  id: string; source: string; name: string; lat: number; lon: number;
  available: boolean; live: boolean; region?: string;
}

export interface OperatorCoverage {
  source: string; total: number; live: number; still: number; offline: number;
}
export interface Coverage {
  total: number; live: number; still: number; offline: number;
  byOperator: OperatorCoverage[];
}

export function coverage(cams: CameraLite[]): Coverage {
  const ops = new Map<string, OperatorCoverage>();
  let live = 0, still = 0, offline = 0;
  for (const c of cams) {
    const bucket: "live" | "still" | "offline" = !c.available ? "offline" : c.live ? "live" : "still";
    if (bucket === "live") live++; else if (bucket === "still") still++; else offline++;
    let o = ops.get(c.source);
    if (!o) { o = { source: c.source, total: 0, live: 0, still: 0, offline: 0 }; ops.set(c.source, o); }
    o.total++; o[bucket]++;
  }
  const byOperator = [...ops.values()].sort((a, b) => b.total - a.total);
  return { total: cams.length, live, still, offline, byOperator };
}
```

- [ ] **Step 3: `lib/cameras/concurrency.ts`** (pure eviction + a tiny store + hook):

```ts
"use client";
// Caps how many live HLS players run at once — a wall of 50 hls.js players would
// crush the browser, so live is click-to-activate and the oldest slot is evicted
// past the cap. The eviction maths is pure (unit-tested); the store is a thin shell.
import { useSyncExternalStore } from "react";

export const HLS_CAP = 6;

/** Pure: activate `id` in an LRU-ish active list, evicting the oldest past `cap`. */
export function nextActive(active: string[], id: string, cap: number = HLS_CAP): string[] {
  const without = active.filter((x) => x !== id);
  const next = [...without, id]; // most-recent last
  return next.length > cap ? next.slice(next.length - cap) : next;
}

let active: string[] = [];
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export const hlsSlots = {
  activate(id: string) { active = nextActive(active, id); emit(); },
  deactivate(id: string) { active = active.filter((x) => x !== id); emit(); },
  get(): string[] { return active; },
  subscribe(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); },
};

export function useHlsActive(id: string): boolean {
  const list = useSyncExternalStore(hlsSlots.subscribe, hlsSlots.get, hlsSlots.get);
  return list.includes(id);
}
```

- [ ] **Step 4: Tests.** `tests/unit/cameras-coverage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { coverage, type CameraLite } from "@/lib/cameras/coverage";

const c = (o: Partial<CameraLite>): CameraLite =>
  ({ id: "x", source: "tfl", name: "n", lat: 0, lon: 0, available: true, live: false, ...o });

describe("coverage", () => {
  it("buckets live / still / offline and groups per operator", () => {
    const cov = coverage([
      c({ source: "caltrans", live: true }),
      c({ source: "caltrans", live: false }),
      c({ source: "tfl", available: false }),
    ]);
    expect(cov.total).toBe(3);
    expect(cov.live).toBe(1);
    expect(cov.still).toBe(1);
    expect(cov.offline).toBe(1);
    const caltrans = cov.byOperator.find((o) => o.source === "caltrans")!;
    expect(caltrans.total).toBe(2);
    expect(caltrans.live).toBe(1);
    const tfl = cov.byOperator.find((o) => o.source === "tfl")!;
    expect(tfl.offline).toBe(1);
  });
});
```

`tests/unit/cameras-concurrency.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextActive } from "@/lib/cameras/concurrency";

describe("nextActive", () => {
  it("adds an id and keeps it under the cap, evicting the oldest", () => {
    let a: string[] = [];
    for (const id of ["a", "b", "c"]) a = nextActive(a, id, 2);
    expect(a).toEqual(["b", "c"]); // "a" evicted
  });
  it("re-activating an existing id moves it to most-recent without growing", () => {
    const a = nextActive(["a", "b"], "a", 2);
    expect(a).toEqual(["b", "a"]);
  });
});
```

- [ ] **Step 5: Gate + commit** — green.
`git add app/api/cameras/route.ts lib/cameras/coverage.ts lib/cameras/concurrency.ts tests/unit/cameras-coverage.test.ts tests/unit/cameras-concurrency.test.ts`
`git commit -m "feat(cameras): enrich /api/cameras + pure coverage + HLS-slot concurrency helpers"`

---

### Task 2: `useCameras` hook + detail skeleton + register

**Files:** Create `lib/cameras/useCameras.ts`, `lib/console/widgets/cameras.detail.tsx`; Modify `lib/console/widgets/cameras.tsx`, `app/globals.css`.

- [ ] **Step 1: `lib/cameras/useCameras.ts`** — a shared ref-counted poller for `/api/cameras` (mirror `useSignalFeed`'s structure): return `{ cameras: CameraLite[]; status: "loading"|"idle"|"error"; updatedAt: number|null }`. Poll ~60s, keep last-good, dormant-safe (`.catch` → keep prior). The response items already match `CameraLite` (id/source/name/lat/lon/available/live/region after Task 1).

- [ ] **Step 2: `lib/console/widgets/cameras.detail.tsx`** — `CamerasDetail(_props: WidgetDetailProps)`:
  - `useCameras()` → cameras; `coverage(cameras)`.
  - Masthead: title "Camera network", `<b>{total}</b> cameras · {live} live · {still} still · {offline} offline`, freshness from `updatedAt`, count sparkline via `recordSeries("cam:count", total, updatedAt)` + `seriesSamples`/`deltaOf` — **only record once cameras arrive** (guard like W4's fix).
  - Honest empty state ("No cameras loaded." on empty).
  - Declare state used later: `const [openId,setOpenId]=useState<string|null>(null)`, `const [sortKey,setSortKey]=useState<"name"|"operator"|"region">("operator")`, `const [dir,setDir]=useState<1|-1>(1)`. (No `noUnusedLocals`, so this compiles.)
  - Placeholder footer (Task 5 fills it).

- [ ] **Step 3:** Add `detail: CamerasDetail` + `import CamerasDetail from "./cameras.detail";` to `CAMERAS_WIDGET` in `cameras.tsx`.

- [ ] **Step 4:** Append `.tn-cm*` CSS (reuse the `.tn-sd*`/`.tn-av*` language: masthead, panels grid, operator chips, camera-wall grid `grid-template-columns: repeat(auto-fill,minmax(200px,1fr))`, tile with caption, table, footer/actions). Theme tokens only.

- [ ] **Step 5: Gate + commit** — green.
`git commit -m "feat(cameras): useCameras hook + focus detail skeleton — coverage masthead"`

---

### Task 3: Coverage bar + region map + operator/region filters

**Files:** Modify `lib/console/widgets/cameras.detail.tsx`.

- Coverage-honesty bar: per `coverage().byOperator`, a chip per operator `{source} · {live}▶ / {still}▦ / {offline}✕` (label live vs still explicitly — TfL is stills-only; Caltrans/SCDOT carry HLS).
- Filters: reuse `cameraFilterStore`/`useCameraFilter` — region/operator toggles + a live-only toggle. Derive `filtered = cameras.filter((c) => filter.passes(c.source, c.live))`.
- Region `InsetMap`: `points = filtered.map((c) => ({ lat:c.lat, lon:c.lon, id:c.id, props:{ name:c.name } }))`, `onSelect={setOpenId}`.

- [ ] **Step 1:** Insert coverage bar + filters + map (grid), all keyed off `filtered`.
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(cameras): focus detail — coverage bar + region map + operator/region filters"`

---

### Task 4: Camera walls (still + click-to-activate live) + sortable table + dossier

**Files:** Modify `lib/console/widgets/cameras.detail.tsx`.

- Wall grid over `filtered`, grouped by operator (or a flat grid): each tile is a `CameraImage` (still) by default. For a `live` camera, overlay a "▶ Live" button; clicking calls `hlsSlots.activate(id)` and the tile swaps to `CameraVideo`; `useHlsActive(id)` decides which render. A "◼ Stop" (or auto-evict past `HLS_CAP`) tears it back to still. Show a small "N/​6 live" counter. Every tile caption: name + operator + freshness (`formatCountdown`/`sampledAgeMs` from `freshness.ts`).
- Sortable table (`name`/`operator`/`region`) over `filtered`; row click toggles `openId`; open → drill row rendering `<CameraDetail object={toWorldObject(c)} />` where `toWorldObject(c) = { kind:"camera", id:c.id, label:c.name, lat:c.lat, lon:c.lon, meta:{ available:c.available } } as WorldObject`.

- [ ] **Step 1:** Insert the wall + table + dossier (keyed-fragment via `import { Fragment }`).
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(cameras): focus detail — still/live camera walls (HLS-capped) + table + dossier"`

---

### Task 5: Footer — attribution + CSV/GeoJSON export

**Files:** Modify `lib/console/widgets/cameras.detail.tsx`.

- Footer: attribution note (per-operator licences are on each `Camera.attribution`/`license`; summarise "Operators: <distinct sources> · see each camera for licence"). 
- Export (disabled when empty): CSV of `filtered` (id, name, source, region, lat, lon, live, available) and GeoJSON via `toGeoJson(filtered.map((c) => ({ lat:c.lat, lon:c.lon, properties:{ name:c.name, source:c.source, live:c.live, available:c.available } })))`, using `exportFilename("cameras", Date.now())`.

- [ ] **Step 1:** Insert footer + export.
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(cameras): focus detail — attribution footer + CSV/GeoJSON export"`

---

### Task 6: Verification

- [ ] Full gate `npx tsc --noEmit && npm test` green; `git status` clean apart from `.superpowers/sdd/progress.md`.
- [ ] Confirm no raw upstream URL is ever rendered (only `/api/proxy?id=` / `/api/hls?id=` via CameraImage/CameraVideo/CameraDetail).
- [ ] Confirm the HLS cap: activating a 7th live tile evicts the oldest (`nextActive` unit test covers the maths; wiring is code-review-verified).
- [ ] If the integrator has a browser: expand the Cameras widget, confirm coverage bar, filters, map, a still wall, one click-to-live tile, table + dossier, export. Otherwise note live visual verification pending.

## Self-Review

- **Spec §7.5 coverage:** (1) coverage-honesty bar (live/still/offline + per-operator, labelled) → Task 3 ✓; (2) live HLS wall, concurrency-capped, click-activated → Task 4 (`hlsSlots`/`useHlsActive`, CAP 6) ✓; (3) refreshing-still walls with per-feed countdowns → Task 4 (CameraImage + `freshness.ts`) ✓; (4) focus rail reusing `CameraDetail` + nearest-cameras → Task 4 dossier (CameraDetail already renders nearby) ✓; (5) filter/export reusing `cameraFilterStore` → Tasks 3+5 ✓. New work: enrich `/api/cameras` (Task 1) + HLS concurrency manager (Task 1 `concurrency.ts`) ✓.
- **Type consistency:** `CameraLite`/`Coverage`/`OperatorCoverage`/`coverage`/`nextActive`/`hlsSlots`/`useHlsActive`/`useCameras` names match across Tasks 1→5.
- **Safety/honesty:** snapshots strictly via proxy-by-id (no SSRF); live capped at 6 (browser safety); coverage labels each feed honestly (still vs live); offline counted; dormant-safe hook; empty states honest.
- **Risk flagged:** the live wall is the riskiest surface — keep it click-to-activate (not viewport auto-play) to bound complexity; if `CameraVideo`'s props differ from the assumed `{id,alt,attribution,license,refreshSeconds}`, adapt to the real signature (verify in source).
