# Ground-Truth Console — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failed widget dashboard with a console-first surface: normalize every hazard signal into one ranked `NormalizedEvent`, render it in a scoped, sourced **Event Feed** (the hero), drive relevance with a global **Scope** control, and default the map to flat 2D (globe demoted to an Explore toggle).

**Architecture:** One pure data spine (`SignalFeature[] → NormalizedEvent[]`, ranked) feeds a thin React shell. All logic lives in pure, unit-tested functions (mirroring `lib/signals/*` + `lib/widgets/topEvents.ts`); hooks/components are dumb impure shells (the repo has no React Testing Library — do not add it). New global state uses the established `useSyncExternalStore` + `lib/shell/persist` store idiom (see `lib/shell/timeWindow.ts`). The console reuses the existing "floating chrome over a full-bleed MapLibre map" architecture — no CSS-grid re-architecture.

**Tech Stack:** Next.js 15.5.19 (App Router) · React 19 · TypeScript 5.7.3 · MapLibre GL 5 · Vitest 2.1.8 · `@/` path alias.

## Global Constraints

- **Commits are SOLO-attributed.** Plain `git commit -m "…"`. **Never** append a `Co-Authored-By: Claude` trailer — this is a job-facing `011-sam-110` repo. (Overrides the default harness trailer instruction.)
- **Branch:** `feat/ground-truth-console-redesign` (already checked out; spec committed at `ef7c2be`).
- **Never run `next build` concurrently with `next dev`** — it corrupts `.next`. Stop the dev server before any `npm run build`.
- **Add only the specific files each commit names** — never `git add -A` (parallel terminals share this working dir).
- **Pure-function discipline:** every non-trivial transform is an exported pure function with a Vitest unit test in `tests/unit/`. Hooks/components stay thin and are verified by `npm run build` + manual smoke, not unit tests.
- **Signal/feed fetchers MUST resolve, never reject** — a failing source yields `[]` (the existing `SignalSource.fetch` contract).
- **Honesty rules (the brand):** never render a fake "0"; empty states echo the active scope + window ("No events above S1 in *Near me · last 1h*"); never imply "all live"; label normalized/derived values for what they are (the Round-1 "MW" mislabel is the anti-pattern).
- **Calm light identity:** use the `--tn-*` CSS tokens in `app/globals.css`; default basemap `positron`.
- **Test command:** `npm run test` (= `vitest run`). Single file: `npx vitest run tests/unit/<file> -t "<name>"`. Type-check: `npx tsc --noEmit`.

## Scope of Phase 1 (and what defers)

Phase 1 ships **World / Near-me / Region** scope. The `Scope` model also carries an `aoi` bbox variant (so `withinScope` is forward-compatible), but the **draw-AOI map interaction defers to P4** (Scope deepening) — it needs a MapLibre draw layer that would bloat this phase. The feed is seeded with the **4 proven event source ids** the current Top Events panel already fetches successfully (`earthquakes`, `fire-active`, `gdacs`, `tropical-cyclones`); more sources (floods, severe-storms, volcanoes, conflict) join in P2/P3 once their normalized magnitude scale is confirmed. Per-source health bar, full provenance object, and per-domain severity are **P3** — P1 carries a lightweight `source` credit + a single transparent magnitude ramp, both explicitly labelled as interim.

**Resolved open questions (spec §15):** Q1 → default scope is **World** (the codebase rule "never geolocate on load" wins; Near-me is one explicit click, and a persisted Near-me rehydrates to World). Q4 → Explore is a **top-bar peer toggle** (`viewMode` store).

---

## File Structure

**New — pure (unit-tested):**
- `lib/events/model.ts` — `NormalizedEvent` + enums + `severityTier`/`severityRank`/`placeName`/`SEVERITY_COLOR`. *(Named `NormalizedEvent`, not `Event`, to avoid shadowing the DOM `Event` global.)*
- `lib/events/sources.ts` — `EventSource` type + `EVENT_SOURCES` constant (which signal ids are events).
- `lib/events/adapter.ts` — `toEvent(feature, source)` + `rankEvents(events)`.
- `lib/shell/scope.ts` — `Scope` type, pure `withinScope` + `coerceSavedScope` + `radiusFromBbox`, plus the persisted store + `useScope`.
- `lib/shell/viewMode.ts` — `console | explore` persisted store + `useViewMode`.
- `lib/widgets/eventFeed.ts` — pure `projectEventFeed(inputs, scope, windowMs, now, filters)`.

**New — impure shells / UI (build + manual verified):**
- `lib/widgets/useEventFeeds.ts` — polls every `EVENT_SOURCES` feed → features-by-source.
- `components/shell/EventFeed.tsx` — the ranked, scoped, sourced feed (the hero).
- `components/shell/ScopeControl.tsx` — top-bar World / Near-me / Region control.
- `components/shell/ConsoleTopBar.tsx` — floating cluster: ScopeControl + TimeWindowControl + Explore toggle.

**Modified:**
- `components/WorldMap.tsx` — projection follows `viewMode` (flat default, globe in Explore).
- `components/shell/ConsoleShell.tsx` — hydrate new stores; mount top bar + feed in console mode; gate the legacy panels to Explore.
- `app/globals.css` — feed / scope / topbar / severity-chip styles.

**New tests:** `tests/unit/events-model.test.ts`, `tests/unit/events-adapter.test.ts`, `tests/unit/scope.test.ts`, `tests/unit/eventFeed.test.ts`, `tests/unit/viewMode.test.ts`.

---

## Task 1: Event model + severity (pure spine)

**Files:**
- Create: `lib/events/model.ts`
- Test: `tests/unit/events-model.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `type EventType = "quake"|"fire"|"disaster"|"cyclone"|"flood"|"storm"|"volcano"|"conflict"|"other"`
  - `type SeverityTier = "S0"|"S1"|"S2"|"S3"|"S4"`
  - `type GeoPrecision = "EXACT"|"CITY"|"ADMIN"|"COUNTRY_CENTROID"`
  - `interface NormalizedEvent { id; type:EventType; title; place:{name:string}; geo:{lat;lon;precision:GeoPrecision}; occurredAt:string|null; severity:{tier:SeverityTier;raw:number}; magnitude?:{value:number;unit:string}; source:{id;label;attribution}; link?:string; color:string }`
  - `severityTier(magnitude:number):SeverityTier`
  - `severityRank(tier:SeverityTier):number`
  - `placeName(title:string, props?:Record<string,unknown>):string`
  - `SEVERITY_COLOR: Record<SeverityTier,string>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/events-model.test.ts
import { describe, it, expect } from "vitest";
import { severityTier, severityRank, placeName, SEVERITY_COLOR } from "@/lib/events/model";

describe("severityTier (interim 0–10 ramp)", () => {
  it("maps the normalized magnitude band to a tier", () => {
    expect(severityTier(9)).toBe("S4");
    expect(severityTier(8)).toBe("S4");
    expect(severityTier(6)).toBe("S3");
    expect(severityTier(4)).toBe("S2");
    expect(severityTier(2)).toBe("S1");
    expect(severityTier(1.9)).toBe("S0");
    expect(severityTier(0)).toBe("S0");
  });
  it("treats a non-finite magnitude as S0 (never throws)", () => {
    expect(severityTier(NaN)).toBe("S0");
    expect(severityTier(Infinity)).toBe("S4"); // >=8 branch; finite-guard only catches NaN
  });
});

describe("severityRank", () => {
  it("orders tiers low→high", () => {
    expect(severityRank("S0")).toBeLessThan(severityRank("S4"));
    expect(severityRank("S3")).toBe(3);
  });
});

describe("placeName", () => {
  it("prefers an explicit props.place", () => {
    expect(placeName("M0.7 - 9 km N of Anza, CA", { place: "Anza, CA" })).toBe("Anza, CA");
  });
  it("falls back to the title tail after a dash", () => {
    expect(placeName("M5.8 - 9 km N of Anza, CA")).toBe("9 km N of Anza, CA");
    expect(placeName("Active fire — Sonoma County")).toBe("Sonoma County");
  });
  it("uses the whole title when there is no delimiter", () => {
    expect(placeName("Tropical Storm Bret")).toBe("Tropical Storm Bret");
  });
});

describe("SEVERITY_COLOR", () => {
  it("has a colour for every tier", () => {
    for (const t of ["S0", "S1", "S2", "S3", "S4"] as const) {
      expect(SEVERITY_COLOR[t]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/events-model.test.ts`
Expected: FAIL — "Failed to resolve import @/lib/events/model".

- [ ] **Step 3: Write the implementation**

```ts
// lib/events/model.ts
// The Event spine. Every hazard signal normalizes to ONE NormalizedEvent — the
// unit the feed, the map and the dossier all read. (Named NormalizedEvent, not
// `Event`, to avoid shadowing the DOM `Event` global.)
//
// P1 severity uses ONE transparent 0–10 magnitude ramp (the shared SignalFeature
// `props.magnitude` convention). P3 (§10.3) replaces this with a per-domain,
// exposure-weighted basis — until then `severity.raw` is surfaced honestly.

export type EventType =
  | "quake" | "fire" | "disaster" | "cyclone"
  | "flood" | "storm" | "volcano" | "conflict" | "other";

export type SeverityTier = "S0" | "S1" | "S2" | "S3" | "S4";

export type GeoPrecision = "EXACT" | "CITY" | "ADMIN" | "COUNTRY_CENTROID";

export interface NormalizedEvent {
  /** Stable id (the source feature id). */
  id: string;
  type: EventType;
  /** Human, specific — reused verbatim from the source feature title. */
  title: string;
  place: { name: string };
  geo: { lat: number; lon: number; precision: GeoPrecision };
  /** ISO UTC event time; null when the source carries none (never faked). */
  occurredAt: string | null;
  /** Display tier + the raw normalized magnitude it derives from (shown, not hidden). */
  severity: { tier: SeverityTier; raw: number };
  /** Native magnitude — populated only where the unit is known-safe (P1: quakes). */
  magnitude?: { value: number; unit: string };
  /** Lightweight source credit (P1). The full Provenance object lands in P3. */
  source: { id: string; label: string; attribution: string };
  link?: string;
  /** Marker/chip colour, from the severity ramp. */
  color: string;
}

const TIER_RANK: Record<SeverityTier, number> = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4 };

export const SEVERITY_COLOR: Record<SeverityTier, string> = {
  S0: "#94a3b8",
  S1: "#eab308",
  S2: "#f97316",
  S3: "#ef4444",
  S4: "#b91c1c",
};

/** Map the shared 0–10 normalized magnitude to a display tier (interim — see header). */
export function severityTier(magnitude: number): SeverityTier {
  if (Number.isNaN(magnitude)) return "S0";
  if (magnitude >= 8) return "S4";
  if (magnitude >= 6) return "S3";
  if (magnitude >= 4) return "S2";
  if (magnitude >= 2) return "S1";
  return "S0";
}

export function severityRank(tier: SeverityTier): number {
  return TIER_RANK[tier];
}

/** Best-effort row place (P1-honest): explicit props.place → the title tail after
 *  a dash/em-dash → the whole title. Country/admin enrichment is P3. */
export function placeName(title: string, props?: Record<string, unknown>): string {
  const explicit = props?.place;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const m = title.match(/\s[—-]\s(.+)$/);
  return (m ? m[1] : title).trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/events-model.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/events/model.ts tests/unit/events-model.test.ts
git commit -m "feat(events): add NormalizedEvent model + severity ramp"
```

---

## Task 2: Event sources + adapter (SignalFeature → NormalizedEvent)

**Files:**
- Create: `lib/events/sources.ts`, `lib/events/adapter.ts`
- Test: `tests/unit/events-adapter.test.ts`

**Interfaces:**
- Consumes: `NormalizedEvent`, `severityTier`, `severityRank`, `placeName`, `SEVERITY_COLOR` (Task 1); `SignalFeature` (`lib/signals/types.ts`).
- Produces:
  - `interface EventSource { id:string; type:EventType; label:string; attribution:string; precision:GeoPrecision; magnitudeUnit?:string }`
  - `EVENT_SOURCES: EventSource[]`
  - `toEvent(f:SignalFeature, src:EventSource):NormalizedEvent`
  - `rankEvents(events:NormalizedEvent[]):NormalizedEvent[]` — severity tier desc, then newest-first (undated last).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/events-adapter.test.ts
import { describe, it, expect } from "vitest";
import type { SignalFeature } from "@/lib/signals/types";
import { EVENT_SOURCES } from "@/lib/events/sources";
import { toEvent, rankEvents } from "@/lib/events/adapter";

const QUAKE = EVENT_SOURCES.find((s) => s.id === "earthquakes")!;
const FIRE = EVENT_SOURCES.find((s) => s.id === "fire-active")!;

const sf = (over: Partial<SignalFeature>): SignalFeature => ({
  id: "x", lat: 1, lon: 2, title: "T", signalId: "s", ...over,
});

describe("EVENT_SOURCES", () => {
  it("seeds the 4 proven event ids", () => {
    expect(EVENT_SOURCES.map((s) => s.id)).toEqual([
      "earthquakes", "fire-active", "gdacs", "tropical-cyclones",
    ]);
  });
});

describe("toEvent", () => {
  it("maps a quake feature into a NormalizedEvent with native M magnitude", () => {
    const e = toEvent(
      sf({ id: "usgs:1", title: "M5.8 - 9 km N of Anza, CA", lat: 33.6, lon: -116.7,
           ts: "2026-06-28T00:00:00Z", props: { magnitude: 5.8, place: "9 km N of Anza, CA" } }),
      QUAKE,
    );
    expect(e.type).toBe("quake");
    expect(e.place.name).toBe("9 km N of Anza, CA");
    expect(e.geo).toEqual({ lat: 33.6, lon: -116.7, precision: "EXACT" });
    expect(e.occurredAt).toBe("2026-06-28T00:00:00Z");
    expect(e.severity.tier).toBe("S2");      // 5.8 → S2
    expect(e.severity.raw).toBe(5.8);
    expect(e.magnitude).toEqual({ value: 5.8, unit: "M" });
    expect(e.source.attribution).toBe("USGS");
  });

  it("omits native magnitude for a source with no known unit (no MW mislabel)", () => {
    const e = toEvent(sf({ title: "Active fire — Sonoma", props: { magnitude: 7 } }), FIRE);
    expect(e.type).toBe("fire");
    expect(e.magnitude).toBeUndefined();     // FIRE has no magnitudeUnit
    expect(e.severity.tier).toBe("S3");      // 7 → S3
  });

  it("treats a missing magnitude as 0 / S0 and a missing ts as null", () => {
    const e = toEvent(sf({ title: "Quiet" }), QUAKE);
    expect(e.severity.raw).toBe(0);
    expect(e.severity.tier).toBe("S0");
    expect(e.occurredAt).toBeNull();
  });
});

describe("rankEvents", () => {
  it("sorts by severity tier desc, then newest-first", () => {
    const rows = rankEvents([
      toEvent(sf({ id: "a", ts: "2026-06-27T00:00:00Z", props: { magnitude: 5 } }), QUAKE),
      toEvent(sf({ id: "b", ts: "2026-06-26T00:00:00Z", props: { magnitude: 8 } }), QUAKE),
      toEvent(sf({ id: "c", ts: "2026-06-28T00:00:00Z", props: { magnitude: 8 } }), QUAKE),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]); // S4 newest, S4 older, then S2
  });
  it("orders undated events after dated ones of the same tier", () => {
    const rows = rankEvents([
      toEvent(sf({ id: "undated", props: { magnitude: 5 } }), QUAKE),
      toEvent(sf({ id: "dated", ts: "2026-06-28T00:00:00Z", props: { magnitude: 5 } }), QUAKE),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["dated", "undated"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/events-adapter.test.ts`
Expected: FAIL — cannot resolve `@/lib/events/sources` / `@/lib/events/adapter`.

- [ ] **Step 3: Write `lib/events/sources.ts`**

```ts
// lib/events/sources.ts
// The curated set of signal sources that emit discrete, time/place-stamped EVENTS
// for the feed. Seeded with the proven ids the Top Events panel already fetches
// successfully (components/shell/TopEventsPanel.tsx). Add more (floods, severe-
// storms, volcanoes, conflict) as each one's normalized magnitude scale is
// confirmed — see the registry in lib/signals/registry.ts.
//
// magnitudeUnit is set ONLY where props.magnitude genuinely IS that unit, so the
// row can show a native value without the Round-1 "MW" mislabel. Leave it unset
// and the row leans on the source's own title for the human magnitude.

import type { EventType, GeoPrecision } from "@/lib/events/model";

export interface EventSource {
  /** Signal source id — the /api/signals/<id> route segment + store key. */
  id: string;
  type: EventType;
  /** Human source label for the row's source credit. */
  label: string;
  attribution: string;
  /** Default geo-precision for this source's points (per-feature precision is P3). */
  precision: GeoPrecision;
  /** Native magnitude unit, only when props.magnitude IS that unit. */
  magnitudeUnit?: string;
}

export const EVENT_SOURCES: EventSource[] = [
  { id: "earthquakes", type: "quake", label: "Earthquakes (USGS)", attribution: "USGS", precision: "EXACT", magnitudeUnit: "M" },
  { id: "fire-active", type: "fire", label: "Active fire (FIRMS)", attribution: "NASA FIRMS", precision: "EXACT" },
  { id: "gdacs", type: "disaster", label: "Disasters (GDACS)", attribution: "GDACS", precision: "ADMIN" },
  { id: "tropical-cyclones", type: "cyclone", label: "Cyclones (NOAA NHC)", attribution: "NOAA NHC", precision: "ADMIN" },
];
```

- [ ] **Step 4: Write `lib/events/adapter.ts`**

```ts
// lib/events/adapter.ts
// SignalFeature → NormalizedEvent, plus the severity×recency ranking. The general
// form of lib/widgets/topEvents.ts (which this supersedes): the magnitude/place/
// time the rows need already ride in each feature — this surfaces them.

import type { SignalFeature } from "@/lib/signals/types";
import type { EventSource } from "@/lib/events/sources";
import {
  type NormalizedEvent,
  severityTier,
  severityRank,
  placeName,
  SEVERITY_COLOR,
} from "@/lib/events/model";

export function toEvent(f: SignalFeature, src: EventSource): NormalizedEvent {
  const raw = Number(f.props?.magnitude ?? 0);
  const tier = severityTier(raw);
  const event: NormalizedEvent = {
    id: f.id,
    type: src.type,
    title: f.title,
    place: { name: placeName(f.title, f.props) },
    geo: { lat: f.lat, lon: f.lon, precision: src.precision },
    occurredAt: f.ts ?? null,
    severity: { tier, raw },
    source: { id: src.id, label: src.label, attribution: src.attribution },
    link: f.link,
    color: SEVERITY_COLOR[tier],
  };
  if (src.magnitudeUnit && Number.isFinite(raw) && raw > 0) {
    event.magnitude = { value: raw, unit: src.magnitudeUnit };
  }
  return event;
}

/** Severity tier desc, then newest-first (undated sorts last). Mirrors topEventsRows. */
export function rankEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  return [...events].sort((a, b) => {
    const sev = severityRank(b.severity.tier) - severityRank(a.severity.tier);
    if (sev !== 0) return sev;
    const at = a.occurredAt ?? "";
    const bt = b.occurredAt ?? "";
    if (at < bt) return 1;
    if (at > bt) return -1;
    return 0;
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/events-adapter.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/events/sources.ts lib/events/adapter.ts tests/unit/events-adapter.test.ts
git commit -m "feat(events): curated event sources + SignalFeature→Event adapter"
```

---

## Task 3: Scope store + `withinScope`

**Files:**
- Create: `lib/shell/scope.ts`
- Test: `tests/unit/scope.test.ts`

**Interfaces:**
- Consumes: `haversineKm` (`lib/geo/haversine.ts`); `loadPersisted`/`savePersisted` (`lib/shell/persist.ts`).
- Produces:
  - `type ScopeMode = "world"|"near-me"|"region"|"aoi"`
  - `interface Scope { mode:ScopeMode; center?:{lat:number;lon:number}; radiusKm?:number; bbox?:[number,number,number,number]; label:string }`
  - `WORLD_SCOPE:Scope`, `DEFAULT_RADIUS_KM:number`
  - `withinScope(lat:number, lon:number, scope:Scope):boolean`
  - `radiusFromBbox(bbox:[number,number,number,number]):number`
  - `coerceSavedScope(saved:unknown):Scope`
  - `scopeStore` (`set`/`get`/`reset`/`hydrate`/`subscribe`), `useScope():Scope`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/scope.test.ts
import { describe, it, expect } from "vitest";
import { withinScope, radiusFromBbox, coerceSavedScope, WORLD_SCOPE, type Scope } from "@/lib/shell/scope";

describe("withinScope", () => {
  it("world admits everything", () => {
    expect(withinScope(80, 170, WORLD_SCOPE)).toBe(true);
  });
  it("near-me / region admit points inside the radius and reject those outside", () => {
    const s: Scope = { mode: "near-me", center: { lat: 51.5, lon: -0.12 }, radiusKm: 50, label: "Near me" };
    expect(withinScope(51.51, -0.13, s)).toBe(true);   // ~1 km away
    expect(withinScope(48.85, 2.35, s)).toBe(false);   // Paris, far outside
  });
  it("aoi admits points inside the bbox [west,south,east,north]", () => {
    const s: Scope = { mode: "aoi", bbox: [-1, 50, 1, 52], label: "AOI" };
    expect(withinScope(51, 0, s)).toBe(true);
    expect(withinScope(60, 0, s)).toBe(false);
  });
  it("falls back to admit-all on a malformed scope (never hide untestable data)", () => {
    expect(withinScope(0, 0, { mode: "near-me", label: "x" })).toBe(true);
    expect(withinScope(0, 0, { mode: "aoi", label: "x" })).toBe(true);
  });
});

describe("radiusFromBbox", () => {
  it("derives a sensible radius (km) from a place extent", () => {
    expect(radiusFromBbox([-0.5, 51.2, 0.3, 51.7])).toBeGreaterThan(20);
    expect(radiusFromBbox([-0.001, 51.5, 0.001, 51.501])).toBeGreaterThanOrEqual(10); // floor
  });
});

describe("coerceSavedScope", () => {
  it("rehydrates a persisted near-me back to World (never auto-geolocates)", () => {
    expect(coerceSavedScope({ mode: "near-me", center: { lat: 1, lon: 2 }, radiusKm: 50, label: "Near me" }))
      .toEqual(WORLD_SCOPE);
  });
  it("keeps a region scope", () => {
    const r: Scope = { mode: "region", center: { lat: 1, lon: 2 }, radiusKm: 100, label: "Berlin" };
    expect(coerceSavedScope(r)).toEqual(r);
  });
  it("returns World for junk", () => {
    expect(coerceSavedScope(null)).toEqual(WORLD_SCOPE);
    expect(coerceSavedScope({ nope: true })).toEqual(WORLD_SCOPE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/scope.test.ts`
Expected: FAIL — cannot resolve `@/lib/shell/scope`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/shell/scope.ts
"use client";
// The global Scope — the relevance spine. A single persisted store (the lib/shell
// idiom) the feed, the map and (later) the alerts all read: World (firehose) /
// Near-me / Region / AOI. Pure withinScope is unit-tested; the store is a thin
// useSyncExternalStore shell. AOI's bbox is modelled now; the draw interaction is
// P4 — withinScope already handles it so nothing changes when the UI arrives.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { haversineKm } from "@/lib/geo/haversine";

export type ScopeMode = "world" | "near-me" | "region" | "aoi";

export interface Scope {
  mode: ScopeMode;
  /** Centre for near-me / region. */
  center?: { lat: number; lon: number };
  /** Radius (km) for centre-based scopes. */
  radiusKm?: number;
  /** [west, south, east, north] for aoi. */
  bbox?: [number, number, number, number];
  /** Human label for the top bar + the feed's honest empty state. */
  label: string;
}

export const WORLD_SCOPE: Scope = { mode: "world", label: "World" };
export const DEFAULT_RADIUS_KM = 250;
const MIN_RADIUS_KM = 10;

/** Pure: is a point inside the scope? Malformed centre/aoi scopes admit
 *  everything — we never silently hide data we cannot test. */
export function withinScope(lat: number, lon: number, scope: Scope): boolean {
  switch (scope.mode) {
    case "near-me":
    case "region":
      if (!scope.center || scope.radiusKm == null) return true;
      return haversineKm(scope.center.lat, scope.center.lon, lat, lon) <= scope.radiusKm;
    case "aoi": {
      if (!scope.bbox) return true;
      const [w, s, e, n] = scope.bbox;
      return lon >= w && lon <= e && lat >= s && lat <= n;
    }
    case "world":
    default:
      return true;
  }
}

/** Radius (km) covering a geocoder extent [west,south,east,north], floored. */
export function radiusFromBbox(bbox: [number, number, number, number]): number {
  const [w, s, e, n] = bbox;
  const midLat = (s + n) / 2;
  const halfDiag = haversineKm(s, w, n, e) / 2;
  void midLat;
  return Math.max(MIN_RADIUS_KM, Math.round(halfDiag));
}

/** A persisted near-me rehydrates to World (we never auto-geolocate on load);
 *  region/aoi/world survive; junk → World. */
export function coerceSavedScope(saved: unknown): Scope {
  const s = saved as Scope | null;
  if (!s || typeof s !== "object" || typeof s.mode !== "string") return WORLD_SCOPE;
  if (s.mode === "near-me") return WORLD_SCOPE;
  if (s.mode === "region" || s.mode === "aoi" || s.mode === "world") return s;
  return WORLD_SCOPE;
}

const PERSIST_KEY = "tn.scope.v1";
const PERSIST_VERSION = 1;

let state: Scope = WORLD_SCOPE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const scopeStore = {
  set(scope: Scope) {
    state = scope;
    emit();
  },
  get(): Scope {
    return state;
  },
  reset() {
    state = WORLD_SCOPE;
    emit();
  },
  hydrate() {
    state = coerceSavedScope(loadPersisted<Scope>(PERSIST_KEY, PERSIST_VERSION));
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useScope(): Scope {
  return useSyncExternalStore(scopeStore.subscribe, scopeStore.get, scopeStore.get);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/shell/scope.ts tests/unit/scope.test.ts
git commit -m "feat(scope): global Scope store + pure withinScope"
```

---

## Task 4: Feed projection (pure) + the fetch hook

**Files:**
- Create: `lib/widgets/eventFeed.ts` (pure), `lib/widgets/useEventFeeds.ts` (impure shell)
- Test: `tests/unit/eventFeed.test.ts`

**Interfaces:**
- Consumes: `toEvent`/`rankEvents` (Task 2), `EVENT_SOURCES`/`EventSource` (Task 2), `withinScope`/`Scope` (Task 3), `withinWindow` (`lib/shell/timeWindow.ts`), `haversineKm`, `severityRank`/`SeverityTier`/`EventType`/`NormalizedEvent` (Task 1), `SignalFeature`.
- Produces:
  - `type FeedSort = "severity"|"recent"|"nearest"`
  - `interface FeedFilters { types:Set<EventType>|null; minTier:SeverityTier; sort:FeedSort }`
  - `interface FeedInput { source:EventSource; features:SignalFeature[] }`
  - `interface ProjectedFeed { rows:NormalizedEvent[]; total:number; shown:number }`
  - `projectEventFeed(inputs:FeedInput[], scope:Scope, windowMs:number|null, now:number, filters:FeedFilters):ProjectedFeed`
  - `interface RawFeeds { bySource:Record<string,SignalFeature[]>; status:"idle"|"loading"|"error"; updatedAt:number|null }`
  - `useEventFeeds():RawFeeds`

- [ ] **Step 1: Write the failing test (pure projection only)**

```ts
// tests/unit/eventFeed.test.ts
import { describe, it, expect } from "vitest";
import type { SignalFeature } from "@/lib/signals/types";
import { EVENT_SOURCES } from "@/lib/events/sources";
import { projectEventFeed, type FeedFilters, type FeedInput } from "@/lib/widgets/eventFeed";
import { WORLD_SCOPE, type Scope } from "@/lib/shell/scope";

const QUAKE = EVENT_SOURCES.find((s) => s.id === "earthquakes")!;
const sf = (over: Partial<SignalFeature>): SignalFeature => ({
  id: "x", lat: 1, lon: 2, title: "T", signalId: "s", ...over,
});
const NOW = Date.parse("2026-06-28T12:00:00Z");
const base: FeedFilters = { types: null, minTier: "S0", sort: "severity" };

const inputs = (feats: SignalFeature[]): FeedInput[] => [{ source: QUAKE, features: feats }];

describe("projectEventFeed", () => {
  it("ranks by severity×recency and reports total vs shown", () => {
    const r = projectEventFeed(inputs([
      sf({ id: "a", props: { magnitude: 5 }, ts: "2026-06-28T10:00:00Z" }),
      sf({ id: "b", props: { magnitude: 8 }, ts: "2026-06-28T09:00:00Z" }),
    ]), WORLD_SCOPE, null, NOW, base);
    expect(r.rows.map((x) => x.id)).toEqual(["b", "a"]);
    expect(r.total).toBe(2);
    expect(r.shown).toBe(2);
  });

  it("applies the severity floor", () => {
    const r = projectEventFeed(inputs([
      sf({ id: "lo", props: { magnitude: 1 } }),
      sf({ id: "hi", props: { magnitude: 9 } }),
    ]), WORLD_SCOPE, null, NOW, { ...base, minTier: "S3" });
    expect(r.rows.map((x) => x.id)).toEqual(["hi"]);
    expect(r.total).toBe(2);
    expect(r.shown).toBe(1);
  });

  it("filters by type", () => {
    const r = projectEventFeed(inputs([sf({ id: "q", props: { magnitude: 5 } })]),
      WORLD_SCOPE, null, NOW, { ...base, types: new Set(["fire"]) });
    expect(r.shown).toBe(0);
  });

  it("trims by scope radius", () => {
    const near: Scope = { mode: "region", center: { lat: 51.5, lon: -0.12 }, radiusKm: 50, label: "London" };
    const r = projectEventFeed(inputs([
      sf({ id: "in", lat: 51.51, lon: -0.13, props: { magnitude: 5 } }),
      sf({ id: "out", lat: 35, lon: 139, props: { magnitude: 5 } }),
    ]), near, null, NOW, base);
    expect(r.rows.map((x) => x.id)).toEqual(["in"]);
  });

  it("trims by the time window (old events drop, undated stay)", () => {
    const r = projectEventFeed(inputs([
      sf({ id: "fresh", props: { magnitude: 5 }, ts: "2026-06-28T11:30:00Z" }),
      sf({ id: "old", props: { magnitude: 5 }, ts: "2026-06-01T00:00:00Z" }),
      sf({ id: "undated", props: { magnitude: 5 } }),
    ]), WORLD_SCOPE, 60 * 60 * 1000, NOW, base);
    expect(r.rows.map((x) => x.id).sort()).toEqual(["fresh", "undated"]);
  });

  it("sort=nearest orders by distance to the scope centre", () => {
    const near: Scope = { mode: "region", center: { lat: 0, lon: 0 }, radiusKm: 100000, label: "x" };
    const r = projectEventFeed(inputs([
      sf({ id: "far", lat: 10, lon: 10, props: { magnitude: 9 } }),
      sf({ id: "close", lat: 1, lon: 1, props: { magnitude: 1 } }),
    ]), near, null, NOW, { ...base, sort: "nearest" });
    expect(r.rows.map((x) => x.id)).toEqual(["close", "far"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/eventFeed.test.ts`
Expected: FAIL — cannot resolve `@/lib/widgets/eventFeed`.

- [ ] **Step 3: Write `lib/widgets/eventFeed.ts`**

```ts
// lib/widgets/eventFeed.ts
// PURE feed projection: SignalFeature[] (by source) → scoped, windowed, filtered,
// ranked NormalizedEvent[] + honest counts. The single place the feed's logic
// lives; the component and the hook are dumb shells around this.

import type { SignalFeature } from "@/lib/signals/types";
import type { EventSource } from "@/lib/events/sources";
import { type NormalizedEvent, type SeverityTier, type EventType, severityRank } from "@/lib/events/model";
import { toEvent, rankEvents } from "@/lib/events/adapter";
import { withinWindow } from "@/lib/shell/timeWindow";
import { withinScope, type Scope } from "@/lib/shell/scope";
import { haversineKm } from "@/lib/geo/haversine";

export type FeedSort = "severity" | "recent" | "nearest";

export interface FeedFilters {
  /** null = all types; otherwise the set to keep. */
  types: Set<EventType> | null;
  minTier: SeverityTier;
  sort: FeedSort;
}

export interface FeedInput {
  source: EventSource;
  features: SignalFeature[];
}

export interface ProjectedFeed {
  rows: NormalizedEvent[];
  /** Events emitted before scope/window/filter trimming (for the "N of M" honesty). */
  total: number;
  /** rows.length after trimming. */
  shown: number;
}

export function projectEventFeed(
  inputs: FeedInput[],
  scope: Scope,
  windowMs: number | null,
  now: number,
  filters: FeedFilters,
): ProjectedFeed {
  const all: NormalizedEvent[] = [];
  for (const { source, features } of inputs) {
    for (const f of features) all.push(toEvent(f, source));
  }
  const total = all.length;
  const floor = severityRank(filters.minTier);

  let rows = all.filter(
    (e) =>
      withinScope(e.geo.lat, e.geo.lon, scope) &&
      withinWindow(e.occurredAt, windowMs, now) &&
      severityRank(e.severity.tier) >= floor &&
      (filters.types == null || filters.types.has(e.type)),
  );

  if (filters.sort === "nearest" && scope.center) {
    const c = scope.center;
    rows = [...rows].sort(
      (a, b) =>
        haversineKm(c.lat, c.lon, a.geo.lat, a.geo.lon) -
        haversineKm(c.lat, c.lon, b.geo.lat, b.geo.lon),
    );
  } else if (filters.sort === "recent") {
    rows = [...rows].sort((a, b) => {
      const at = a.occurredAt ?? "";
      const bt = b.occurredAt ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0;
    });
  } else {
    rows = rankEvents(rows);
  }

  return { rows, total, shown: rows.length };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/eventFeed.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the impure fetch hook `lib/widgets/useEventFeeds.ts`**

```ts
// lib/widgets/useEventFeeds.ts
"use client";
// Fetch every EVENT_SOURCES feed through the generic /api/signals/<id> proxy on a
// cadence, accumulating the latest features per source. A thin impure shell (no
// unit test — the logic it feeds lives in lib/widgets/eventFeed.ts). Dormant-safe:
// a failed source keeps its last features; status is "error" only if ALL fail.

import { useEffect, useState } from "react";
import type { SignalFeature } from "@/lib/signals/types";
import { EVENT_SOURCES } from "@/lib/events/sources";

export interface RawFeeds {
  bySource: Record<string, SignalFeature[]>;
  status: "idle" | "loading" | "error";
  updatedAt: number | null;
}

const POLL_MS = 5 * 60_000;

export function useEventFeeds(): RawFeeds {
  const [bySource, setBySource] = useState<Record<string, SignalFeature[]>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      setStatus("loading");
      Promise.all(
        EVENT_SOURCES.map((s) =>
          fetch(`/api/signals/${encodeURIComponent(s.id)}`)
            .then((r) => r.json())
            .then((d) => ({ id: s.id, features: (d.features as SignalFeature[]) ?? [], ok: true }))
            .catch(() => ({ id: s.id, features: [] as SignalFeature[], ok: false })),
        ),
      ).then((results) => {
        if (!alive) return;
        setBySource((prev) => {
          const next = { ...prev };
          for (const r of results) if (r.ok) next[r.id] = r.features;
          return next;
        });
        setStatus(results.every((r) => !r.ok) ? "error" : "idle");
        setUpdatedAt(Date.now());
      });
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { bySource, status, updatedAt };
}
```

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add lib/widgets/eventFeed.ts lib/widgets/useEventFeeds.ts tests/unit/eventFeed.test.ts
git commit -m "feat(feed): pure event-feed projection + multi-source fetch hook"
```

---

## Task 5: The Event Feed component (the hero)

**Files:**
- Create: `components/shell/EventFeed.tsx`
- Modify: `app/globals.css` (append the feed styles below)

**Interfaces:**
- Consumes: `useEventFeeds` (Task 4), `projectEventFeed`/`FeedFilters`/`FeedSort` (Task 4), `EVENT_SOURCES` (Task 2), `useScope` (Task 3), `useTimeWindow`/`windowMsFor`/`TIME_WINDOWS` (`lib/shell/timeWindow.ts`), `useNow`/`formatAge` (`lib/shell/useNow.ts`), `openSignalFeature` (`lib/widgets/openSignal.ts`), `EventType`/`SeverityTier`/`SEVERITY_COLOR` (Task 1), `SignalFeature`.
- Produces: `export default function EventFeed()` — the right-docked feed panel.

- [ ] **Step 1: Write the component**

```tsx
// components/shell/EventFeed.tsx
"use client";
// The Event Feed — the console hero. Ranked, scoped, sourced rows built by the
// pure projectEventFeed from the live EVENT_SOURCES feeds. Click a row → fly +
// open its dossier (reusing openSignalFeature, exactly like the old Top Events
// panel). Honest empty state echoes the active scope + window.

import { useMemo, useState } from "react";
import type { SignalFeature } from "@/lib/signals/types";
import { EVENT_SOURCES } from "@/lib/events/sources";
import type { EventType, SeverityTier } from "@/lib/events/model";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedSort, type FeedInput } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { useTimeWindow, windowMsFor, TIME_WINDOWS } from "@/lib/shell/timeWindow";
import { useNow, formatAge } from "@/lib/shell/useNow";
import { openSignalFeature } from "@/lib/widgets/openSignal";

const TIERS: SeverityTier[] = ["S0", "S1", "S2", "S3", "S4"];
const TYPES: EventType[] = Array.from(new Set(EVENT_SOURCES.map((s) => s.type)));
const SORTS: { key: FeedSort; label: string }[] = [
  { key: "severity", label: "Severity" },
  { key: "recent", label: "Recent" },
  { key: "nearest", label: "Nearest" },
];

export default function EventFeed() {
  const scope = useScope();
  const win = useTimeWindow();
  const now = useNow(1000);
  const { bySource, status, updatedAt } = useEventFeeds();

  const [minTier, setMinTier] = useState<SeverityTier>("S0");
  const [sort, setSort] = useState<FeedSort>("severity");
  const [type, setType] = useState<EventType | null>(null);

  // Keep the original SignalFeature for each event id so a row click can reuse the
  // exact map-fly + dossier behaviour.
  const featureById = useMemo(() => {
    const m = new Map<string, { feature: SignalFeature; label: string }>();
    for (const s of EVENT_SOURCES) {
      for (const f of bySource[s.id] ?? []) m.set(f.id, { feature: f, label: s.label });
    }
    return m;
  }, [bySource]);

  const inputs: FeedInput[] = useMemo(
    () => EVENT_SOURCES.map((source) => ({ source, features: bySource[source.id] ?? [] })),
    [bySource],
  );

  const projected = useMemo(
    () =>
      projectEventFeed(inputs, scope, windowMsFor(win), now, {
        types: type ? new Set([type]) : null,
        minTier,
        sort: sort === "nearest" && !scope.center ? "severity" : sort,
      }),
    [inputs, scope, win, now, type, minTier, sort],
  );

  const winLabel = TIME_WINDOWS.find((w) => w.key === win)?.label ?? win;
  const open = (id: string) => {
    const hit = featureById.get(id);
    if (hit) openSignalFeature(hit.feature, hit.label, 7);
  };

  return (
    <aside className="tn-feed" role="region" aria-label="Event feed">
      <header className="tn-feed-head">
        <h2 className="tn-feed-title">Events</h2>
        <span className="tn-feed-count tn-num">
          {projected.shown}
          {projected.shown !== projected.total ? ` / ${projected.total}` : ""}
        </span>
      </header>

      <div className="tn-feed-controls">
        <select
          aria-label="Minimum severity"
          value={minTier}
          onChange={(e) => setMinTier(e.target.value as SeverityTier)}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}+
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as FeedSort)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key} disabled={s.key === "nearest" && !scope.center}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="tn-feed-types">
          <button
            type="button"
            className={`tn-feed-type${type === null ? " on" : ""}`}
            onClick={() => setType(null)}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`tn-feed-type${type === t ? " on" : ""}`}
              onClick={() => setType(type === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {projected.shown === 0 ? (
        <p className="tn-feed-empty">
          {status === "loading"
            ? "Loading events…"
            : status === "error"
              ? "Event sources are unavailable right now."
              : `No events above ${minTier} in ${scope.label} · last ${winLabel}.`}
        </p>
      ) : (
        <ol className="tn-feed-list">
          {projected.rows.map((e) => (
            <li key={e.id}>
              <button type="button" className="tn-feed-row" onClick={() => open(e.id)}>
                <span className="tn-feed-sev" style={{ background: e.color }}>
                  {e.severity.tier}
                </span>
                <span className="tn-feed-main">
                  <span className="tn-feed-row-title">
                    <span className="tn-feed-kind">{e.type}</span> {e.place.name}
                  </span>
                  <span className="tn-feed-meta">
                    {e.occurredAt ? `${formatAge(now - Date.parse(e.occurredAt))} · ` : ""}
                    {e.source.attribution}
                    {e.magnitude ? ` · ${e.magnitude.value} ${e.magnitude.unit}` : ""}
                    {" · "}
                    <span className="tn-feed-prec">{e.geo.precision.toLowerCase()}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <footer className="tn-feed-foot">
        {updatedAt != null ? `Updated ${formatAge(now - updatedAt)} ago` : "—"} ·{" "}
        {EVENT_SOURCES.length} sources
      </footer>
    </aside>
  );
}
```

- [ ] **Step 2: Append the feed styles to `app/globals.css`**

```css
/* ── Event Feed (console hero) ─────────────────────────────────────────────── */
.tn-feed {
  position: fixed;
  top: var(--tn-topbar-h);
  right: 0;
  bottom: var(--tn-ticker-h);
  width: 360px;
  max-width: 92vw;
  z-index: 25;
  display: flex;
  flex-direction: column;
  background: var(--tn-surface);
  backdrop-filter: blur(12px);
  border-left: 1px solid var(--tn-border);
  box-shadow: var(--tn-shadow);
  color: var(--tn-text);
  font-family: var(--tn-sans);
}
.tn-feed-head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 12px 14px 8px; border-bottom: 1px solid var(--tn-border);
}
.tn-feed-title { font-size: 14px; font-weight: 650; margin: 0; letter-spacing: 0.01em; }
.tn-feed-count { font-size: 12px; color: var(--tn-text-muted); }
.tn-feed-controls {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid var(--tn-border);
}
.tn-feed-controls select {
  font: inherit; font-size: 12px; padding: 3px 6px;
  background: var(--tn-surface-2); color: var(--tn-text);
  border: 1px solid var(--tn-border); border-radius: 6px;
}
.tn-feed-types { display: flex; flex-wrap: wrap; gap: 4px; }
.tn-feed-type {
  font-size: 11px; padding: 2px 8px; border-radius: 999px; cursor: pointer;
  background: var(--tn-chip-bg); color: var(--tn-text-muted);
  border: 1px solid transparent; text-transform: capitalize;
}
.tn-feed-type.on { background: var(--tn-accent-soft); color: var(--tn-accent-strong); border-color: var(--tn-accent); }
.tn-feed-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.tn-feed-row {
  display: flex; gap: 10px; width: 100%; text-align: left; cursor: pointer;
  padding: 9px 12px; background: transparent; border: 0; border-bottom: 1px solid var(--tn-border);
  color: inherit;
}
.tn-feed-row:hover { background: var(--tn-surface-2); }
.tn-feed-sev {
  flex: none; align-self: flex-start; font-family: var(--tn-mono);
  font-size: 11px; font-weight: 700; color: #fff; padding: 1px 6px; border-radius: 5px;
}
.tn-feed-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tn-feed-row-title { font-size: 13px; line-height: 1.3; }
.tn-feed-kind { color: var(--tn-text-muted); text-transform: capitalize; font-weight: 600; }
.tn-feed-meta { font-size: 11px; color: var(--tn-text-faint); }
.tn-feed-prec { font-variant: small-caps; }
.tn-feed-empty { padding: 18px 14px; font-size: 13px; color: var(--tn-text-muted); }
.tn-feed-foot {
  padding: 8px 12px; font-size: 11px; color: var(--tn-text-faint);
  border-top: 1px solid var(--tn-border);
}
@media (max-width: 640px) {
  .tn-feed { width: 100%; top: auto; height: 52vh; border-left: 0; border-top: 1px solid var(--tn-border); }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (The component is not yet mounted — Task 8 mounts it. This step only proves it compiles.)

- [ ] **Step 4: Commit**

```bash
git add components/shell/EventFeed.tsx app/globals.css
git commit -m "feat(feed): Event Feed component + styles"
```

---

## Task 6: The Scope control (top bar)

**Files:**
- Create: `components/shell/ScopeControl.tsx`
- Modify: `app/globals.css` (append the scope styles below)

**Interfaces:**
- Consumes: `scopeStore`/`useScope`/`WORLD_SCOPE`/`DEFAULT_RADIUS_KM`/`radiusFromBbox`/`Scope` (Task 3); `mapViewStore` (`lib/mapView.ts`); `GeocodeResult` (`lib/geo/geocode.ts`).
- Produces: `export default function ScopeControl()`.

- [ ] **Step 1: Write the component**

```tsx
// components/shell/ScopeControl.tsx
"use client";
// The global Scope control. World / Near-me / Region — drives scopeStore (the feed
// + map relevance) and flies the map to the chosen centre. Geolocation is requested
// ONLY on an explicit "Near me" click (never on load); denial falls back to World
// with a calm note. Region reuses the keyless /api/geocode used by PlaceSearch.

import { useCallback, useEffect, useRef, useState } from "react";
import { scopeStore, useScope, WORLD_SCOPE, DEFAULT_RADIUS_KM, radiusFromBbox } from "@/lib/shell/scope";
import { mapViewStore } from "@/lib/mapView";
import type { GeocodeResult } from "@/lib/geo/geocode";

export default function ScopeControl() {
  const scope = useScope();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const reqRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setNote(null);
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [close]);

  // Debounced region search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      const myReq = ++reqRef.current;
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          if (myReq !== reqRef.current) return;
          setResults((d.results as GeocodeResult[]) ?? []);
        })
        .catch(() => {
          if (myReq === reqRef.current) setResults([]);
        });
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const setWorld = () => {
    scopeStore.set(WORLD_SCOPE);
    close();
  };

  const setRegion = (r: GeocodeResult) => {
    const radiusKm = r.bbox ? radiusFromBbox(r.bbox) : DEFAULT_RADIUS_KM;
    scopeStore.set({ mode: "region", center: { lat: r.lat, lon: r.lon }, radiusKm, label: r.name });
    mapViewStore.flyToPoint({ lat: r.lat, lon: r.lon, zoom: 8 });
    close();
  };

  const setNearMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNote("Location isn't available in this browser.");
      return;
    }
    setNote("Finding your location…");
    const myReq = ++reqRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (myReq !== reqRef.current) return;
        const { latitude, longitude } = pos.coords;
        scopeStore.set({
          mode: "near-me",
          center: { lat: latitude, lon: longitude },
          radiusKm: DEFAULT_RADIUS_KM,
          label: "Near me",
        });
        mapViewStore.flyToPoint({ lat: latitude, lon: longitude, zoom: 8 });
        close();
      },
      () => {
        if (myReq !== reqRef.current) return;
        setNote("Location denied — still showing World. Search a region instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="tn-scope" ref={rootRef}>
      <button
        type="button"
        className="tn-scope-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span aria-hidden>◎</span> {scope.label}
        <span className="tn-scope-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="tn-scope-menu" role="menu">
          <button type="button" className="tn-scope-item" role="menuitem" onClick={setNearMe}>
            Near me
          </button>
          <button type="button" className="tn-scope-item" role="menuitem" onClick={setWorld}>
            World
          </button>
          <div className="tn-scope-region">
            <input
              className="tn-scope-input"
              type="search"
              placeholder="Region — search a place…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Scope to a region"
            />
            {results.length > 0 && (
              <div className="tn-scope-results" role="listbox">
                {results.map((r) => (
                  <button
                    key={`${r.name}:${r.lat},${r.lon}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="tn-scope-result"
                    onClick={() => setRegion(r)}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {note && <p className="tn-scope-note">{note}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Append the scope styles to `app/globals.css`**

```css
/* ── Scope control (console top bar) ───────────────────────────────────────── */
.tn-scope { position: relative; font-family: var(--tn-sans); }
.tn-scope-btn {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px;
  background: var(--tn-surface); color: var(--tn-text);
  border: 1px solid var(--tn-border); box-shadow: var(--tn-shadow-sm);
}
.tn-scope-caret { color: var(--tn-text-faint); font-size: 10px; }
.tn-scope-menu {
  position: absolute; top: calc(100% + 6px); left: 0; width: 280px; z-index: 40;
  display: flex; flex-direction: column; gap: 4px; padding: 8px;
  background: var(--tn-surface-solid); border: 1px solid var(--tn-border);
  border-radius: 10px; box-shadow: var(--tn-shadow);
}
.tn-scope-item {
  text-align: left; cursor: pointer; font-size: 13px; padding: 7px 10px; border-radius: 7px;
  background: transparent; color: var(--tn-text); border: 0;
}
.tn-scope-item:hover { background: var(--tn-surface-2); }
.tn-scope-region { border-top: 1px solid var(--tn-border); padding-top: 6px; margin-top: 2px; }
.tn-scope-input {
  width: 100%; font: inherit; font-size: 13px; padding: 7px 10px;
  background: var(--tn-surface-2); color: var(--tn-text);
  border: 1px solid var(--tn-border); border-radius: 7px;
}
.tn-scope-results { display: flex; flex-direction: column; margin-top: 4px; max-height: 220px; overflow-y: auto; }
.tn-scope-result {
  text-align: left; cursor: pointer; font-size: 12px; padding: 6px 10px; border-radius: 6px;
  background: transparent; color: var(--tn-text); border: 0;
}
.tn-scope-result:hover { background: var(--tn-surface-2); }
.tn-scope-note { font-size: 11px; color: var(--tn-text-muted); margin: 6px 4px 2px; }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/shell/ScopeControl.tsx app/globals.css
git commit -m "feat(scope): top-bar Scope control (World/Near-me/Region)"
```

---

## Task 7: View-mode store + flat-map default

**Files:**
- Create: `lib/shell/viewMode.ts`
- Modify: `components/WorldMap.tsx`
- Test: `tests/unit/viewMode.test.ts`

**Interfaces:**
- Consumes: `loadPersisted`/`savePersisted` (`lib/shell/persist.ts`).
- Produces:
  - `type ViewMode = "console"|"explore"`, `DEFAULT_VIEW_MODE`
  - `coerceViewMode(saved:unknown):ViewMode`
  - `viewModeStore` (`set`/`toggle`/`get`/`hydrate`/`subscribe`), `useViewMode():ViewMode`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/viewMode.test.ts
import { describe, it, expect } from "vitest";
import { coerceViewMode, DEFAULT_VIEW_MODE } from "@/lib/shell/viewMode";

describe("coerceViewMode", () => {
  it("defaults to console", () => {
    expect(DEFAULT_VIEW_MODE).toBe("console");
    expect(coerceViewMode(null)).toBe("console");
    expect(coerceViewMode("nonsense")).toBe("console");
  });
  it("keeps a valid saved mode", () => {
    expect(coerceViewMode("explore")).toBe("explore");
    expect(coerceViewMode("console")).toBe("console");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/viewMode.test.ts`
Expected: FAIL — cannot resolve `@/lib/shell/viewMode`.

- [ ] **Step 3: Write `lib/shell/viewMode.ts`**

```ts
// lib/shell/viewMode.ts
"use client";
// Console (default, flat 2D map) vs Explore (the 3D globe + cinematic dive). One
// persisted store the shell reads to choose chrome, and WorldMap reads to choose
// its MapLibre projection. The redesign flips the default from globe-as-hero to
// console-as-hero (spec §4, §11).

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export type ViewMode = "console" | "explore";
export const DEFAULT_VIEW_MODE: ViewMode = "console";

export function coerceViewMode(saved: unknown): ViewMode {
  return saved === "explore" || saved === "console" ? saved : DEFAULT_VIEW_MODE;
}

const PERSIST_KEY = "tn.viewmode.v1";
const PERSIST_VERSION = 1;

let state: ViewMode = DEFAULT_VIEW_MODE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const viewModeStore = {
  set(m: ViewMode) {
    if (state === m) return;
    state = m;
    emit();
  },
  toggle() {
    state = state === "console" ? "explore" : "console";
    emit();
  },
  get(): ViewMode {
    return state;
  },
  hydrate() {
    state = coerceViewMode(loadPersisted<ViewMode>(PERSIST_KEY, PERSIST_VERSION));
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useViewMode(): ViewMode {
  return useSyncExternalStore(viewModeStore.subscribe, viewModeStore.get, viewModeStore.get);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/viewMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the projection in `components/WorldMap.tsx`**

WorldMap currently **forces** globe projection. Make projection follow `viewMode`: flat (`mercator`) in console, `globe` in Explore.

5a. Add the import near the other `lib/` imports (the file already imports from `@/lib/mapView` — add this beneath it):

```tsx
import { viewModeStore } from "@/lib/shell/viewMode";
```

5b. Find the forced-globe projection (around `components/WorldMap.tsx:307-309`):

```tsx
      // Force globe projection (a freshly-set style may reset to mercator).
      if (map.getProjection?.()?.type !== "globe") {
        map.setProjection({ type: "globe" });
```

Replace that `setProjection` call so it honours the current view mode. Define a tiny helper and use it both here and on view-mode change:

```tsx
      // Projection follows the view mode: flat (console, default) vs globe (Explore).
      const wantProjection = viewModeStore.get() === "explore" ? "globe" : "mercator";
      if (map.getProjection?.()?.type !== wantProjection) {
        map.setProjection({ type: wantProjection });
```

(Keep the surrounding `if`/closing braces; only the projection *value* changes from a hard-coded `"globe"` to `wantProjection`.)

5c. Add an effect that re-applies projection when the view mode changes, modelled on the existing `registerFlyToPoint` effect (around `components/WorldMap.tsx:983`). Place it next to those `useEffect`s:

```tsx
  // Re-project live when the user toggles Console ⇄ Explore.
  useEffect(() => {
    return viewModeStore.subscribe(() => {
      const map = mapRef.current;
      if (!map) return;
      const want = viewModeStore.get() === "explore" ? "globe" : "mercator";
      if (map.getProjection?.()?.type !== want) map.setProjection({ type: want });
    });
  }, []);
```

> If the map handle in this file is not named `mapRef.current`, use whatever the surrounding effects use to reach the live `maplibregl.Map` (grep the file for `.setProjection(` and `registerFlyToPoint` to confirm the handle name). Do **not** introduce a new ref.

- [ ] **Step 6: Manual verification (build, not dev — never concurrent)**

```bash
npm run build && npm run start
```

Visit `http://localhost:3000` → the map must render **flat** (mercator), not a globe. Then in the browser console:

```js
__map && __map.setProjection({ type: "globe" }); // sanity: the handle still projects
```

Stop the server (Ctrl-C) when done.

- [ ] **Step 7: Commit**

```bash
git add lib/shell/viewMode.ts components/WorldMap.tsx tests/unit/viewMode.test.ts
git commit -m "feat(view): viewMode store + flat-map default (globe → Explore)"
```

---

## Task 8: Console layout integration (capstone)

**Files:**
- Create: `components/shell/ConsoleTopBar.tsx`
- Modify: `components/shell/ConsoleShell.tsx`, `app/globals.css` (append the topbar styles)

**Interfaces:**
- Consumes: `ScopeControl` (Task 6), `TimeWindowControl` (`components/shell/TimeWindowControl.tsx`), `viewModeStore`/`useViewMode` (Task 7), `EventFeed` (Task 5), `scopeStore` (Task 3).
- Produces: `export default function ConsoleTopBar()`; an updated `ConsoleShell` that mounts the console chrome in `console` mode and the legacy globe chrome in `explore` mode.

- [ ] **Step 1: Write `components/shell/ConsoleTopBar.tsx`**

```tsx
// components/shell/ConsoleTopBar.tsx
"use client";
// The console's floating control cluster, under the status bar (the established
// "floating chrome over a full-bleed map" idiom — cf. PlaceSearch). Holds the
// global Scope control, the shared time-window, and the Console⇄Explore toggle.

import ScopeControl from "@/components/shell/ScopeControl";
import TimeWindowControl from "@/components/shell/TimeWindowControl";
import { viewModeStore } from "@/lib/shell/viewMode";

export default function ConsoleTopBar() {
  return (
    <div className="tn-console-topbar">
      <ScopeControl />
      <TimeWindowControl />
      <button
        type="button"
        className="tn-console-explore"
        onClick={() => viewModeStore.set("explore")}
        title="Switch to the 3D globe"
      >
        <span aria-hidden>🌐</span> Explore
      </button>
    </div>
  );
}
```

> Confirm `components/shell/TimeWindowControl.tsx` has a default export. If it is a **named** export, import it as `{ TimeWindowControl }` instead — grep the file's `export` line before writing this import.

- [ ] **Step 2: Append the topbar styles to `app/globals.css`**

```css
/* ── Console top bar (floating cluster) ────────────────────────────────────── */
.tn-console-topbar {
  position: fixed; top: calc(var(--tn-topbar-h) + 8px); left: 12px; z-index: 26;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.tn-console-explore {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px;
  background: var(--tn-surface); color: var(--tn-text);
  border: 1px solid var(--tn-border); box-shadow: var(--tn-shadow-sm);
}
.tn-console-explore:hover { border-color: var(--tn-border-strong); }
/* A small "← Console" affordance lives in the existing globe chrome (Explore). */
.tn-explore-return {
  position: fixed; top: calc(var(--tn-topbar-h) + 8px); left: 12px; z-index: 26;
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px;
  background: var(--tn-surface); color: var(--tn-text);
  border: 1px solid var(--tn-border); box-shadow: var(--tn-shadow-sm);
}
```

- [ ] **Step 3: Rewire `components/shell/ConsoleShell.tsx`**

Replace the imports + the hydration effect + the returned JSX so the new stores hydrate and the chrome splits by `viewMode`. Concretely:

3a. Add these imports beside the existing shell imports (after the `IntelColumn` import line):

```tsx
import { scopeStore } from "@/lib/shell/scope";
import { viewModeStore, useViewMode } from "@/lib/shell/viewMode";
import EventFeed from "@/components/shell/EventFeed";
import ConsoleTopBar from "@/components/shell/ConsoleTopBar";
```

3b. In the hydration `useEffect`, add the two new stores (alongside `watchlistStore.hydrate()` etc.):

```tsx
    scopeStore.hydrate();
    viewModeStore.hydrate();
```

3c. Read the mode in the component body (next to `const ws = useWorkspace();`):

```tsx
  const view = useViewMode();
  const isConsole = view === "console";
```

3d. Replace the returned JSX block (currently `components/shell/ConsoleShell.tsx:59-76`) with the mode-split layout. Keep StatusBar / BreakingBanner / PanelHost / CommandPalette / FeedOverlay / CinematicDive mounted in BOTH modes; the globe-era panels (CoveragePanel, MarketsPanel, WatchlistPanel, DockableWorkspace, IntelColumn, PlaceSearch) render only in Explore; the console chrome (ConsoleTopBar, EventFeed) only in Console:

```tsx
  return (
    <div className="tn-shell">
      {children}
      <StatusBar onOpenPalette={() => setPaletteOpen(true)} />
      <BreakingBanner />
      <PanelHost />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {isConsole ? (
        <>
          <ConsoleTopBar />
          <EventFeed />
        </>
      ) : (
        <>
          <button
            type="button"
            className="tn-explore-return"
            onClick={() => viewModeStore.set("console")}
            title="Back to the console"
          >
            <span aria-hidden>←</span> Console
          </button>
          <PlaceSearch />
          {!ws.open && <CoveragePanel />}
          {!ws.open && <MarketsPanel />}
          {!ws.open && <WatchlistPanel />}
          <DockableWorkspace />
          <IntelColumn />
        </>
      )}

      <FeedOverlay />
      <CinematicDive />
    </div>
  );
```

> Note: `PlaceSearch` moves from always-on into the Explore branch (in Console, the Scope control owns place search). Leave every existing import in place — they are all still referenced across the two branches.

- [ ] **Step 4: Full test suite**

Run: `npm run test`
Expected: all unit tests PASS (the 5 new files + the pre-existing suite — `widgets-mappers.test.ts` still green; nothing was removed).

- [ ] **Step 5: Build + manual smoke (build, never concurrent with dev)**

```bash
npm run build && npm run start
```

Verify at `http://localhost:3000`:
1. **Console is the default** — flat map, a right-hand **Events** feed, a top-left cluster (Scope ▾ · time window · Explore 🌐). No globe, no dock, no IntelColumn.
2. **Feed populates** — within ~10s rows appear (earthquakes at least), each: `Sx` chip · type · place · age · source · precision. Click a row → map flies + the dossier opens.
3. **Scope works** — open Scope ▾ → type a city → pick it → the feed trims to that region and the header shows `N / M`; the empty state (raise "min severity" to S4) reads e.g. *"No events above S4 in <city> · last All."* "Near me" prompts for location once; denial shows the calm note and stays World.
4. **Time window works** — switching 1h/6h/24h trims the feed.
5. **Explore toggle** — click Explore 🌐 → the globe returns with the old chrome + a "← Console" button that returns. Reload → it reopens in Console (persisted default).

Stop the server when done.

- [ ] **Step 6: Commit**

```bash
git add components/shell/ConsoleTopBar.tsx components/shell/ConsoleShell.tsx app/globals.css
git commit -m "feat(console): mount Event Feed + Scope top bar; demote globe to Explore"
```

---

## Self-Review

**Spec coverage (§-by-§):**
- §3 Event model → Tasks 1–2 (`NormalizedEvent` + adapter). *Interim vs spec:* the full `provenance`/`exposure`/`baseline`/`footprint` fields are explicitly P3/P4; P1 ships `source` + a labelled magnitude ramp. ✔ (boundary stated)
- §4 Console layout → Task 8 (top bar + right feed; floating-chrome variant of the wireframe, not CSS grid — noted). ✔
- §5 Event Feed → Task 5 (ranked, scoped, sourced rows; sort severity/recent/nearest; filter type + severity floor; click→fly+dossier; honest empty state). *Dedup disclosure ("▸ 3 reports") is P3.* ✔ (boundary stated)
- §6 Scope & time → Tasks 3 + 6 (World/Near-me/Region wired to feed + map; time-window reused). *Draw-AOI UI is P4* (bbox modelled). ✔ (boundary stated)
- §11 Explore demotion → Task 7 (flat default) + Task 8 (toggle). ✔
- §15 Q1/Q4 → resolved in "Scope of Phase 1". ✔

**Placeholder scan:** no "TBD"/"handle edge cases"/uncoded steps — every code step carries complete code. The two "confirm the export/handle name" notes (Tasks 7, 8) are guardrails against a wrong-symbol guess, not deferred work; the code to write is fully shown.

**Type consistency:** `NormalizedEvent`, `EventSource`, `Scope`, `FeedFilters`, `FeedInput`, `ProjectedFeed`, `ViewMode` names + signatures match across producing/consuming tasks. `severityTier`/`severityRank`/`placeName`/`withinScope`/`withinWindow`/`projectEventFeed`/`coerceSavedScope`/`coerceViewMode`/`radiusFromBbox` are each defined once and referenced with the same arity. `useEventFeeds` (Task 4) is the name imported in Task 5. Row click reuses `openSignalFeature(feature, label, zoom)` — the existing 3-arg signature.

**Out-of-scope guardrails honored:** no React Testing Library added (shells verified by build); no `git add -A`; commits carry no Claude trailer; `next build` only run after stopping any dev server.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-ground-truth-console-phase1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
