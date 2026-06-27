# Widgetize Phase 1 — Source Catalog + Monitor Widgets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the 53 data sources into one searchable Source Catalog and render any source as a generic read-only "monitor widget," hosted in a minimal static grid over the existing globe — the visible "widgetize everything" payoff, with zero new network pollers.

**Architecture:** A pure `SOURCE_CATALOG` merges the 4 core layers (`lib/layers.ts`) and the 39 signals (`lib/signals/registry.ts`) behind one descriptor. Pure helper modules derive unified count/freshness/delta and roll-up aggregation; all logic is node-unit-tested. Thin React components (`SourceWidget`, `SourceCatalog`, `Workspace`) read those helpers plus the **existing** stores — adding a widget spawns no fetch. The catalog gives each source two orthogonal toggles (`◇ Map` / `▦ Widget`); the map stays full-bleed behind the widget layer (it only becomes a grid tile in Phase 3).

**Tech Stack:** Next.js 15.5 / React 19, TypeScript, module-singleton `useSyncExternalStore` stores, Vitest (node env, pure `.ts` only).

## Global Constraints

- **Test infra is node-env Vitest on pure `.ts` only** (`vitest.config.ts`: `environment: "node"`, `include: ["tests/unit/**/*.test.ts"]`). **Do NOT add jsdom / @testing-library** — put testable logic in pure functions; verify components with the build.
- **The build (ESLint) is the authoritative check.** `noUnusedLocals` is OFF, so `tsc` passes on dead vars — a clean `npm run build` is the real gate.
- **Never run `npm run build` concurrently with `next dev`** (corrupts `.next`).
- **`tsc --noEmit`**: ignore any error whose path contains `.claude/worktrees` (orphan dir).
- **Vitest baseline = 152 passing.** Every task must keep all prior tests green; new tasks add tests.
- **Commits are SOLO-attributed — NO `Co-Authored-By` / Claude trailer.** Git user is `011-sam-110`.
- **Never `git add -A`** (parallel terminals share this working dir). Add only the exact files the task touched.
- **No new pollers in Phase 1.** Widgets are read-only store subscribers; all fetching stays in the existing gating feeds. Widget-driven fetch (ref-counting) is Phase 4.
- **Reads only these existing stores:** `lib/metrics.ts` (`metricsStore`/`useMetrics`/`Metrics`), `lib/freshness.ts` (`freshnessStore`/`useFreshness`/`classifyFreshness`/`freshnessAgeMs`/`FreshSourceId`/`FreshState`/`SourceRecord`), `lib/signals/store.ts` (`signalsStore`/`useSignals`/`signalCountsStore`/`useSignalCounts`), `lib/signals/freshness.ts` (`useSignalFreshness`/`classifySignalFreshness`/`signalFreshAgeMs`/`SignalFreshState`), `lib/signals/registry.ts` (`SIGNALS`/`signalsByGroup`/`getSignal`), `lib/layers.ts` (`layersStore`/`useLayers`/`LayerKey`/`ACTIVE_LAYERS`), `lib/shell/persist.ts` (`loadPersisted`/`savePersisted`), `lib/shell/useNow.ts` (`useNow`/`formatAge`).

---

## File Structure (Phase 1)

**Create (pure logic — unit-tested, node):**
- `lib/sources/catalog.ts` — `CatalogSource` type + `SOURCE_CATALOG` (core ⊕ signals) + `catalogByGroup()` + `getCatalogSource()` + `CORE_IDS` + `kindOf()`.
- `lib/sources/freshKind.ts` — unified `FreshKind` enum + `unifyCoreFresh()` / `unifySignalFresh()` + `freshRank()` + `worseFresh()`.
- `lib/widgets/history.ts` — count-history store + pure `pushSample()` / `deltaOf()` / `trendOf()`.
- `lib/widgets/registry.ts` — `WidgetDescriptor` + `rollupWidgets()` + `sourceWidget()` + `widgetForKey()`.
- `lib/widgets/rollup.ts` — `constituentIds()` + `rollupCount()` + `rollupFresh()`.
- `lib/widgets/placement.ts` — placement store + pure `addKey()` / `removeKey()` + persistence.

**Create (thin React — build-verified):**
- `lib/sources/live.ts` — `useSourceLive(source)` hook + `toggleSourceMap(source, on)`.
- `components/shell/SourceWidget.tsx` — generic monitor widget (leaf + rollup modes).
- `components/shell/SourceCatalog.tsx` — the unified catalog (evolves `LayerRail`; two toggles + search + counter).
- `components/shell/Workspace.tsx` + `components/shell/WidgetHost.tsx` — minimal static grid host.

**Modify:**
- `lib/shell/panelRegistry.ts` — repoint `layerRail.component` to `SourceCatalog`.
- `components/shell/ConsoleShell.tsx` — mount `<Workspace />`.
- `app/globals.css` — widget + workspace styles.

**Tests:** `tests/unit/sources-catalog.test.ts`, `tests/unit/sources-freshkind.test.ts`, `tests/unit/widgets-history.test.ts`, `tests/unit/widgets-registry.test.ts`, `tests/unit/widgets-rollup.test.ts`, `tests/unit/widgets-placement.test.ts`.

---

### Task 1: Unified Source Catalog (`lib/sources/catalog.ts`)

**Files:**
- Create: `lib/sources/catalog.ts`
- Test: `tests/unit/sources-catalog.test.ts`

**Interfaces:**
- Consumes: `SIGNALS`, `SignalSource` from `@/lib/signals/registry` + `@/lib/signals/types`.
- Produces:
  - `type SourceKind = "core" | "signal"`
  - `interface CatalogSource { id: string; kind: SourceKind; label: string; group: string; color: string; attribution: string; refreshMs: number; keyEnv?: string }`
  - `const CORE_IDS: readonly ["cameras","planes","satellites","webcams"]`
  - `const SOURCE_CATALOG: CatalogSource[]`
  - `function catalogByGroup(): { group: string; sources: CatalogSource[] }[]`
  - `function getCatalogSource(id: string): CatalogSource | undefined`
  - `function kindOf(id: string): SourceKind`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/sources-catalog.test.ts
import { expect, test } from "vitest";
import {
  SOURCE_CATALOG, catalogByGroup, getCatalogSource, kindOf, CORE_IDS,
} from "@/lib/sources/catalog";
import { SIGNALS } from "@/lib/signals/registry";

test("catalog contains the 4 core layers plus every signal", () => {
  expect(SOURCE_CATALOG.length).toBe(CORE_IDS.length + SIGNALS.length);
  for (const id of CORE_IDS) {
    const s = getCatalogSource(id);
    expect(s?.kind).toBe("core");
  }
  for (const sig of SIGNALS) {
    expect(getCatalogSource(sig.id)?.kind).toBe("signal");
  }
});

test("every catalog source has the required descriptor fields", () => {
  for (const s of SOURCE_CATALOG) {
    expect(s.id).toBeTruthy();
    expect(s.label).toBeTruthy();
    expect(s.group).toBeTruthy();
    expect(s.color).toMatch(/^#/);
    expect(s.attribution).toBeTruthy();
    expect(s.refreshMs).toBeGreaterThan(0);
  }
});

test("ids are unique", () => {
  const ids = SOURCE_CATALOG.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("catalogByGroup preserves order and partitions every source exactly once", () => {
  const groups = catalogByGroup();
  const flat = groups.flatMap((g) => g.sources);
  expect(flat.length).toBe(SOURCE_CATALOG.length);
  // group labels are non-empty and unique
  const labels = groups.map((g) => g.group);
  expect(new Set(labels).size).toBe(labels.length);
});

test("kindOf classifies core vs signal", () => {
  expect(kindOf("cameras")).toBe("core");
  expect(kindOf(SIGNALS[0].id)).toBe("signal");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sources-catalog.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sources/catalog'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/sources/catalog.ts
// The single unified view over every monitorable data source: the 4 bespoke core
// layers (lib/layers.ts) and the 39 data-driven signals (lib/signals/registry.ts),
// flattened behind one descriptor so the catalog UI and the widget grid can be
// data-driven off ONE list. Pure + isomorphic (node-testable): static descriptors
// only — live count/freshness are read from the existing stores by lib/sources/live.ts.

import { SIGNALS } from "@/lib/signals/registry";

export type SourceKind = "core" | "signal";

export interface CatalogSource {
  id: string;
  kind: SourceKind;
  label: string;
  group: string;
  color: string;
  attribution: string;
  refreshMs: number;
  /** Env var that unlocks the source, if key-gated (drives the "needs key" state later). */
  keyEnv?: string;
}

export const CORE_IDS = ["cameras", "planes", "satellites", "webcams"] as const;
type CoreId = (typeof CORE_IDS)[number];

// Core-layer descriptors. refreshMs mirrors lib/freshness.ts seed(); groups use the
// roll-up vocabulary (a group with one source still yields a valid 1-source roll-up).
const CORE_SOURCES: CatalogSource[] = [
  { id: "cameras",    kind: "core", label: "Cameras",    group: "Cameras",  color: "#0e7d97", attribution: "TfL · Caltrans · SCDOT · Digitraffic · 511 · DriveBC", refreshMs: 300_000 },
  { id: "webcams",    kind: "core", label: "Webcams",    group: "Cameras",  color: "#ec4899", attribution: "Windy.com — global webcams", refreshMs: 600_000 },
  { id: "planes",     kind: "core", label: "Planes",     group: "Aviation", color: "#d97706", attribution: "adsb.lol — live ADS-B", refreshMs: 12_000 },
  { id: "satellites", kind: "core", label: "Satellites", group: "Space",    color: "#7c3aed", attribution: "CelesTrak TLE · SGP4 (local)", refreshMs: 1_000 },
];

const SIGNAL_SOURCES: CatalogSource[] = SIGNALS.map((s) => ({
  id: s.id,
  kind: "signal" as const,
  label: s.label,
  group: s.group,
  color: s.color,
  attribution: s.attribution,
  refreshMs: s.refreshMs,
}));

/** Core first (always-relevant transport layers), then signals in registry order. */
export const SOURCE_CATALOG: CatalogSource[] = [...CORE_SOURCES, ...SIGNAL_SOURCES];

const BY_ID = new Map(SOURCE_CATALOG.map((s) => [s.id, s]));

export function getCatalogSource(id: string): CatalogSource | undefined {
  return BY_ID.get(id);
}

export function kindOf(id: string): SourceKind {
  return (CORE_IDS as readonly string[]).includes(id) ? "core" : "signal";
}

/** Grouped by `group`, preserving first-seen order — drives the catalog + roll-ups. */
export function catalogByGroup(): { group: string; sources: CatalogSource[] }[] {
  const out: { group: string; sources: CatalogSource[] }[] = [];
  for (const s of SOURCE_CATALOG) {
    let g = out.find((x) => x.group === s.group);
    if (!g) {
      g = { group: s.group, sources: [] };
      out.push(g);
    }
    g.sources.push(s);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/sources-catalog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sources/catalog.ts tests/unit/sources-catalog.test.ts
git commit -m "feat(sources): unified SOURCE_CATALOG over core layers + signals"
```

---

### Task 2: Unified freshness enum (`lib/sources/freshKind.ts`)

**Files:**
- Create: `lib/sources/freshKind.ts`
- Test: `tests/unit/sources-freshkind.test.ts`

**Interfaces:**
- Consumes: `FreshState` from `@/lib/freshness`, `SignalFreshState` from `@/lib/signals/freshness`.
- Produces:
  - `type FreshKind = "off" | "unknown" | "live" | "empty" | "lagging" | "stale" | "down"`
  - `function unifyCoreFresh(s: FreshState): FreshKind`
  - `function unifySignalFresh(s: SignalFreshState): FreshKind`
  - `function freshRank(k: FreshKind): number` (higher = worse)
  - `function worseFresh(a: FreshKind, b: FreshKind): FreshKind`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/sources-freshkind.test.ts
import { expect, test } from "vitest";
import { unifyCoreFresh, unifySignalFresh, freshRank, worseFresh } from "@/lib/sources/freshKind";

test("core states map onto the unified kind (no 'empty' for core)", () => {
  expect(unifyCoreFresh("live")).toBe("live");
  expect(unifyCoreFresh("lagging")).toBe("lagging");
  expect(unifyCoreFresh("stale")).toBe("stale");
  expect(unifyCoreFresh("down")).toBe("down");
  expect(unifyCoreFresh("unknown")).toBe("unknown");
});

test("signal states map onto the unified kind, preserving 'empty'", () => {
  expect(unifySignalFresh("empty")).toBe("empty");
  expect(unifySignalFresh("live")).toBe("live");
  expect(unifySignalFresh("down")).toBe("down");
});

test("rank orders healthy below broken so worst-of picks the broken one", () => {
  expect(freshRank("live")).toBeLessThan(freshRank("lagging"));
  expect(freshRank("lagging")).toBeLessThan(freshRank("stale"));
  expect(freshRank("stale")).toBeLessThan(freshRank("down"));
  expect(freshRank("empty")).toBe(freshRank("live")); // both healthy
});

test("worseFresh returns the higher-ranked (worse) of two states", () => {
  expect(worseFresh("live", "stale")).toBe("stale");
  expect(worseFresh("down", "lagging")).toBe("down");
  expect(worseFresh("live", "empty")).toBe("live"); // tie → first; both healthy
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sources-freshkind.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/sources/freshKind.ts
// One freshness vocabulary across the two different per-source freshness systems:
// core layers (lib/freshness.ts → FreshState) and signals (lib/signals/freshness.ts
// → SignalFreshState, which adds the honest "empty" = connected-but-zero state).
// `off` is added for a placed widget whose source is not currently being fetched
// (Phase 1: no widget-driven fetch yet). Pure + node-testable.

import type { FreshState } from "@/lib/freshness";
import type { SignalFreshState } from "@/lib/signals/freshness";

export type FreshKind = "off" | "unknown" | "live" | "empty" | "lagging" | "stale" | "down";

export function unifyCoreFresh(s: FreshState): FreshKind {
  return s; // FreshState ⊂ FreshKind
}

export function unifySignalFresh(s: SignalFreshState): FreshKind {
  return s; // SignalFreshState ⊂ FreshKind
}

// Higher = worse. Healthy (live/empty) lowest; broken (down) highest. `off`/`unknown`
// sit mid: not an error, but not delivering data either.
const RANK: Record<FreshKind, number> = {
  live: 0,
  empty: 0,
  lagging: 1,
  off: 2,
  unknown: 2,
  stale: 3,
  down: 4,
};

export function freshRank(k: FreshKind): number {
  return RANK[k];
}

export function worseFresh(a: FreshKind, b: FreshKind): FreshKind {
  return RANK[b] > RANK[a] ? b : a;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/sources-freshkind.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sources/freshKind.ts tests/unit/sources-freshkind.test.ts
git commit -m "feat(sources): unified FreshKind across core + signal freshness"
```

---

### Task 3: Count-history store + delta/trend (`lib/widgets/history.ts`)

**Files:**
- Create: `lib/widgets/history.ts`
- Test: `tests/unit/widgets-history.test.ts`

**Interfaces:**
- Consumes: nothing (pure ring buffer + a singleton store; fed by the live hook in Task 6).
- Produces:
  - `interface CountSample { t: number; n: number }`
  - `function pushSample(buf: CountSample[], s: CountSample, cap?: number): CountSample[]` (pure; cap default 24)
  - `function deltaOf(buf: CountSample[]): number` (latest − previous; 0 if <2)
  - `function trendOf(buf: CountSample[], slots: number): number[]` (last `slots` counts normalized 0..1)
  - `const countHistoryStore = { record(id, n, at?), get(): Record<string, CountSample[]>, subscribe() }`
  - `function useCountHistory(id: string): CountSample[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/widgets-history.test.ts
import { expect, test } from "vitest";
import { pushSample, deltaOf, trendOf, type CountSample } from "@/lib/widgets/history";

const s = (t: number, n: number): CountSample => ({ t, n });

test("pushSample appends and caps to the most recent N", () => {
  let buf: CountSample[] = [];
  for (let i = 0; i < 30; i++) buf = pushSample(buf, s(i, i), 24);
  expect(buf.length).toBe(24);
  expect(buf[0].n).toBe(6); // oldest kept = 30-24
  expect(buf[buf.length - 1].n).toBe(29);
});

test("pushSample collapses a same-count consecutive sample (only time advances)", () => {
  let buf = pushSample([], s(1, 5));
  buf = pushSample(buf, s(2, 5)); // unchanged count → keep one, update time
  expect(buf.length).toBe(1);
  expect(buf[0].t).toBe(2);
});

test("deltaOf is latest minus previous, 0 when fewer than two samples", () => {
  expect(deltaOf([])).toBe(0);
  expect(deltaOf([s(1, 10)])).toBe(0);
  expect(deltaOf([s(1, 10), s(2, 13)])).toBe(3);
  expect(deltaOf([s(1, 13), s(2, 8)])).toBe(-5);
});

test("trendOf returns the last `slots` counts normalized 0..1", () => {
  const buf = [s(1, 0), s(2, 5), s(3, 10)];
  expect(trendOf(buf, 3)).toEqual([0, 0.5, 1]);
  // all-equal → flat 0.5 line, never divide-by-zero
  expect(trendOf([s(1, 4), s(2, 4)], 2)).toEqual([0.5, 0.5]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/widgets-history.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/widgets/history.ts
"use client";
// A tiny per-source count history so a monitor widget can show a ▴/▾ delta and a
// glance sparkline WITHOUT any new fetch — the live hook records the count it already
// reads from the existing stores. Pure ring-buffer maths (node-tested) + a thin
// module-singleton store (mirrors lib/metrics.ts).

import { useSyncExternalStore } from "react";

export interface CountSample {
  t: number; // epoch ms
  n: number; // count at t
}

const CAP = 24;

/** Pure: append a sample, collapsing a same-count tail (only advancing time), capped. */
export function pushSample(buf: CountSample[], s: CountSample, cap: number = CAP): CountSample[] {
  const last = buf[buf.length - 1];
  let next: CountSample[];
  if (last && last.n === s.n) {
    next = [...buf.slice(0, -1), { t: s.t, n: s.n }];
  } else {
    next = [...buf, s];
  }
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Pure: latest − previous; 0 when fewer than two samples. */
export function deltaOf(buf: CountSample[]): number {
  if (buf.length < 2) return 0;
  return buf[buf.length - 1].n - buf[buf.length - 2].n;
}

/** Pure: last `slots` counts normalized to 0..1 (flat 0.5 line when all equal). */
export function trendOf(buf: CountSample[], slots: number): number[] {
  const tail = buf.slice(-slots).map((x) => x.n);
  if (tail.length === 0) return [];
  const min = Math.min(...tail);
  const max = Math.max(...tail);
  if (max === min) return tail.map(() => 0.5);
  return tail.map((n) => (n - min) / (max - min));
}

// --- store ------------------------------------------------------------------
let hist: Record<string, CountSample[]> = {};
const listeners = new Set<() => void>();

export const countHistoryStore = {
  record(id: string, n: number, at: number = Date.now()) {
    const prev = hist[id] ?? [];
    const next = pushSample(prev, { t: at, n });
    if (next === prev) return;
    hist = { ...hist, [id]: next };
    for (const l of listeners) l();
  },
  get(): Record<string, CountSample[]> {
    return hist;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const EMPTY: CountSample[] = [];
export function useCountHistory(id: string): CountSample[] {
  const all = useSyncExternalStore(countHistoryStore.subscribe, countHistoryStore.get, countHistoryStore.get);
  return all[id] ?? EMPTY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/widgets-history.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/widgets/history.ts tests/unit/widgets-history.test.ts
git commit -m "feat(widgets): per-source count history for delta + glance sparkline"
```

---

### Task 4: Widget registry + roll-up aggregation (`lib/widgets/registry.ts`, `lib/widgets/rollup.ts`)

**Files:**
- Create: `lib/widgets/registry.ts`, `lib/widgets/rollup.ts`
- Test: `tests/unit/widgets-registry.test.ts`, `tests/unit/widgets-rollup.test.ts`

**Interfaces:**
- Consumes: `SOURCE_CATALOG`, `catalogByGroup`, `getCatalogSource` from `@/lib/sources/catalog`; `FreshKind`, `worseFresh` from `@/lib/sources/freshKind`.
- Produces (`registry.ts`):
  - `type WidgetKind = "rollup" | "source"`
  - `interface WidgetDescriptor { key: string; kind: WidgetKind; title: string; ref: string; defaultGrid: { w: number; h: number; minW: number; minH: number } }`
  - `function rollupKey(group: string): string` → `"rollup:<group>"`
  - `function sourceKey(id: string): string` → `"source:<id>"`
  - `function rollupWidgets(): WidgetDescriptor[]` (one per catalog group)
  - `function sourceWidget(id: string): WidgetDescriptor | undefined`
  - `function widgetForKey(key: string): WidgetDescriptor | undefined`
- Produces (`rollup.ts`):
  - `function constituentIds(group: string): string[]`
  - `function rollupCount(counts: Record<string, number | undefined>, ids: string[]): number | null`
  - `function rollupFresh(states: FreshKind[]): FreshKind`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/widgets-registry.test.ts
import { expect, test } from "vitest";
import { rollupWidgets, sourceWidget, widgetForKey, rollupKey, sourceKey } from "@/lib/widgets/registry";
import { catalogByGroup } from "@/lib/sources/catalog";

test("one roll-up widget per catalog group, stable keys", () => {
  const groups = catalogByGroup();
  const rollups = rollupWidgets();
  expect(rollups.length).toBe(groups.length);
  expect(rollups.every((w) => w.kind === "rollup")).toBe(true);
  expect(rollups[0].key).toBe(rollupKey(groups[0].group));
});

test("sourceWidget builds a leaf descriptor for a known id, undefined otherwise", () => {
  const w = sourceWidget("cameras");
  expect(w?.kind).toBe("source");
  expect(w?.key).toBe(sourceKey("cameras"));
  expect(w?.title).toBe("Cameras");
  expect(sourceWidget("nope")).toBeUndefined();
});

test("widgetForKey resolves both kinds and enforces min sizes", () => {
  const groups = catalogByGroup();
  const r = widgetForKey(rollupKey(groups[0].group));
  expect(r?.kind).toBe("rollup");
  const s = widgetForKey(sourceKey("planes"));
  expect(s?.kind).toBe("source");
  expect(s!.defaultGrid.minW).toBeGreaterThan(0);
  expect(s!.defaultGrid.minH).toBeGreaterThan(0);
  expect(widgetForKey("bogus:x")).toBeUndefined();
});
```

```ts
// tests/unit/widgets-rollup.test.ts
import { expect, test } from "vitest";
import { constituentIds, rollupCount, rollupFresh } from "@/lib/widgets/rollup";
import { catalogByGroup } from "@/lib/sources/catalog";

test("constituentIds returns the source ids of a group", () => {
  const g = catalogByGroup()[0];
  expect(constituentIds(g.group)).toEqual(g.sources.map((s) => s.id));
  expect(constituentIds("no-such-group")).toEqual([]);
});

test("rollupCount sums known counts, null when no constituent has data", () => {
  expect(rollupCount({ a: 3, b: 5 }, ["a", "b"])).toBe(8);
  expect(rollupCount({ a: 3 }, ["a", "b"])).toBe(3); // b unknown → skipped
  expect(rollupCount({}, ["a", "b"])).toBeNull(); // nothing known
});

test("rollupFresh is worst-of its constituents", () => {
  expect(rollupFresh(["live", "lagging", "stale"])).toBe("stale");
  expect(rollupFresh(["live", "empty"])).toBe("live"); // both healthy
  expect(rollupFresh([])).toBe("off"); // nothing placed/known
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/widgets-registry.test.ts tests/unit/widgets-rollup.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementations**

```ts
// lib/widgets/rollup.ts
// Pure roll-up aggregation: a category widget = the sources of one catalog `group`.
// Count = sum of known constituent counts; freshness = worst-of (a roll-up is only
// as fresh as its slowest source). node-tested.

import { catalogByGroup } from "@/lib/sources/catalog";
import { worseFresh, type FreshKind } from "@/lib/sources/freshKind";

export function constituentIds(group: string): string[] {
  const g = catalogByGroup().find((x) => x.group === group);
  return g ? g.sources.map((s) => s.id) : [];
}

export function rollupCount(counts: Record<string, number | undefined>, ids: string[]): number | null {
  let sum = 0;
  let any = false;
  for (const id of ids) {
    const c = counts[id];
    if (typeof c === "number") {
      sum += c;
      any = true;
    }
  }
  return any ? sum : null;
}

export function rollupFresh(states: FreshKind[]): FreshKind {
  if (states.length === 0) return "off";
  return states.reduce((acc, s) => worseFresh(acc, s));
}
```

```ts
// lib/widgets/registry.ts
// Descriptors for the two Phase-1 data widget kinds: one roll-up per catalog group,
// and a leaf per source (born from a roll-up pop-out). Stable string keys are the
// placement + (later) layout-override identity. Utility widgets (map/video/etc.)
// are NOT defined here in Phase 1 — they keep their existing PANEL_REGISTRY entries.

import { SOURCE_CATALOG, catalogByGroup, getCatalogSource } from "@/lib/sources/catalog";

export type WidgetKind = "rollup" | "source";

export interface WidgetDescriptor {
  key: string;
  kind: WidgetKind;
  title: string;
  /** group name (rollup) or source id (source). */
  ref: string;
  defaultGrid: { w: number; h: number; minW: number; minH: number };
}

export function rollupKey(group: string): string {
  return `rollup:${group}`;
}
export function sourceKey(id: string): string {
  return `source:${id}`;
}

const ROLLUP_GRID = { w: 3, h: 3, minW: 2, minH: 2 };
const SOURCE_GRID = { w: 3, h: 2, minW: 2, minH: 2 };

export function rollupWidgets(): WidgetDescriptor[] {
  return catalogByGroup().map((g) => ({
    key: rollupKey(g.group),
    kind: "rollup" as const,
    title: g.group,
    ref: g.group,
    defaultGrid: { ...ROLLUP_GRID },
  }));
}

export function sourceWidget(id: string): WidgetDescriptor | undefined {
  const s = getCatalogSource(id);
  if (!s) return undefined;
  return { key: sourceKey(id), kind: "source", title: s.label, ref: id, defaultGrid: { ...SOURCE_GRID } };
}

export function widgetForKey(key: string): WidgetDescriptor | undefined {
  if (key.startsWith("rollup:")) {
    const group = key.slice("rollup:".length);
    return rollupWidgets().find((w) => w.ref === group);
  }
  if (key.startsWith("source:")) {
    return sourceWidget(key.slice("source:".length));
  }
  return undefined;
}

/** All leaf source ids (used by the catalog "add widget" tray). */
export function allSourceKeys(): string[] {
  return SOURCE_CATALOG.map((s) => sourceKey(s.id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/widgets-registry.test.ts tests/unit/widgets-rollup.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/widgets/registry.ts lib/widgets/rollup.ts tests/unit/widgets-registry.test.ts tests/unit/widgets-rollup.test.ts
git commit -m "feat(widgets): widget registry (rollup/leaf) + roll-up aggregation"
```

---

### Task 5: Placement store (`lib/widgets/placement.ts`)

**Files:**
- Create: `lib/widgets/placement.ts`
- Test: `tests/unit/widgets-placement.test.ts`

**Interfaces:**
- Consumes: `loadPersisted`, `savePersisted` from `@/lib/shell/persist`.
- Produces:
  - `function addKey(keys: string[], key: string): string[]` (pure; idempotent append)
  - `function removeKey(keys: string[], key: string): string[]` (pure)
  - `const placementStore = { get(): string[], has(key): boolean, add(key), remove(key), toggle(key), hydrate(), subscribe() }`
  - `function usePlacement(): string[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/widgets-placement.test.ts
import { expect, test } from "vitest";
import { addKey, removeKey } from "@/lib/widgets/placement";

test("addKey appends once (idempotent), preserving order", () => {
  expect(addKey([], "a")).toEqual(["a"]);
  expect(addKey(["a"], "b")).toEqual(["a", "b"]);
  expect(addKey(["a", "b"], "a")).toEqual(["a", "b"]); // already present → unchanged
});

test("removeKey drops the key, no-op when absent", () => {
  expect(removeKey(["a", "b"], "a")).toEqual(["b"]);
  expect(removeKey(["a"], "z")).toEqual(["a"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/widgets-placement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/widgets/placement.ts
"use client";
// Which widget keys are currently placed in the workspace (ordered). The ▦ Widget
// axis of the Source Catalog writes here; the Workspace renders from here. Persisted
// so a composed board survives reload. Pure reducers (node-tested) + a thin store.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

const PERSIST_KEY = "tn.widgets.v1";
const PERSIST_VERSION = 1;

export function addKey(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys : [...keys, key];
}
export function removeKey(keys: string[], key: string): string[] {
  return keys.filter((k) => k !== key);
}

let keys: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, keys);
}

export const placementStore = {
  get(): string[] {
    return keys;
  },
  has(key: string): boolean {
    return keys.includes(key);
  },
  add(key: string) {
    const next = addKey(keys, key);
    if (next === keys) return;
    keys = next;
    emit();
  },
  remove(key: string) {
    const next = removeKey(keys, key);
    if (next.length === keys.length) return;
    keys = next;
    emit();
  },
  toggle(key: string) {
    keys = keys.includes(key) ? removeKey(keys, key) : addKey(keys, key);
    emit();
  },
  hydrate() {
    const saved = loadPersisted<string[]>(PERSIST_KEY, PERSIST_VERSION);
    if (Array.isArray(saved)) keys = saved;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function usePlacement(): string[] {
  return useSyncExternalStore(placementStore.subscribe, placementStore.get, placementStore.get);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/widgets-placement.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/widgets/placement.ts tests/unit/widgets-placement.test.ts
git commit -m "feat(widgets): placement store for which widgets are on the board"
```

---

### Task 6: Live hook + the monitor widget (`lib/sources/live.ts`, `components/shell/SourceWidget.tsx`)

**Files:**
- Create: `lib/sources/live.ts`, `components/shell/SourceWidget.tsx`
- Test: none new (pure logic already covered; component is build-verified per Global Constraints).

**Interfaces:**
- Consumes: Task 1 (`getCatalogSource`, `CatalogSource`, `kindOf`), Task 2 (`unifyCoreFresh`/`unifySignalFresh`/`FreshKind`), Task 3 (`countHistoryStore`/`useCountHistory`/`deltaOf`/`trendOf`), Task 4 (`constituentIds`/`rollupCount`/`rollupFresh`/`WidgetDescriptor`, `sourceKey`/`rollupKey`), Task 5 (`placementStore`), plus existing stores listed in Global Constraints.
- Produces:
  - `interface SourceLive { count: number | null; fresh: FreshKind; mapOn: boolean; hasData: boolean }`
  - `function useSourceLive(id: string): SourceLive`
  - `function toggleSourceMap(id: string, on: boolean): void`
  - `default export SourceWidget({ widget }: { widget: WidgetDescriptor })`

- [ ] **Step 1: Implement the live hook**

```ts
// lib/sources/live.ts
"use client";
// Bridges a CatalogSource to its LIVE state by reading the EXISTING stores — core
// layers via metrics + lib/freshness, signals via signalCounts + lib/signals/freshness.
// No fetch is started here (Phase 1: widgets are read-only). Also records each count
// into countHistoryStore so widgets get a delta + sparkline for free.

import { useEffect } from "react";
import { getCatalogSource, kindOf } from "@/lib/sources/catalog";
import { unifyCoreFresh, unifySignalFresh, type FreshKind } from "@/lib/sources/freshKind";
import { countHistoryStore } from "@/lib/widgets/history";
import { useMetrics, type Metrics } from "@/lib/metrics";
import { useFreshness, classifyFreshness, type FreshSourceId } from "@/lib/freshness";
import { useSignals, useSignalCounts, signalsStore } from "@/lib/signals/store";
import { useSignalFreshness, classifySignalFreshness } from "@/lib/signals/freshness";
import { useLayers, layersStore, type LayerKey } from "@/lib/layers";
import { useNow } from "@/lib/shell/useNow";

export interface SourceLive {
  count: number | null;
  fresh: FreshKind;
  mapOn: boolean;
  hasData: boolean;
}

function coreCount(id: string, m: Metrics): number | null {
  switch (id) {
    case "cameras": return m.camerasTotal || null;
    case "planes": return m.planes || null;
    case "satellites": return m.satellites || null;
    case "webcams": return m.webcams || null;
    default: return null;
  }
}

export function useSourceLive(id: string): SourceLive {
  const now = useNow(1000);
  const metrics = useMetrics();
  const coreFresh = useFreshness();
  const layers = useLayers();
  const sigOn = useSignals();
  const sigCounts = useSignalCounts();
  const sigFresh = useSignalFreshness();
  const source = getCatalogSource(id);

  let live: SourceLive;
  if (source && kindOf(id) === "core") {
    const mapOn = layers[id as LayerKey] === true;
    const rec = coreFresh.find((r) => r.id === (id as FreshSourceId));
    const count = coreCount(id, metrics);
    const fresh: FreshKind = !mapOn ? "off" : rec ? unifyCoreFresh(classifyFreshness(rec, now)) : "unknown";
    live = { count, fresh, mapOn, hasData: mapOn && rec != null };
  } else if (source) {
    const mapOn = sigOn[id] === true;
    const raw = sigFresh[id];
    const count = sigCounts[id] ?? null;
    const fresh: FreshKind = !mapOn
      ? "off"
      : raw
        ? unifySignalFresh(classifySignalFreshness({ ...raw, refreshMs: source.refreshMs }, now))
        : "unknown";
    live = { count, fresh, mapOn, hasData: raw != null };
  } else {
    live = { count: null, fresh: "off", mapOn: false, hasData: false };
  }

  // Feed the history ring whenever we have a real count (drives delta + sparkline).
  useEffect(() => {
    if (live.count != null) countHistoryStore.record(id, live.count, now);
  }, [id, live.count, now]);

  return live;
}

export function toggleSourceMap(id: string, on: boolean): void {
  if (kindOf(id) === "core") layersStore.set(id as LayerKey, on);
  else signalsStore.set(id, on);
}
```

- [ ] **Step 2: Implement the monitor widget**

```tsx
// components/shell/SourceWidget.tsx
"use client";
// The generic Phase-1 monitor widget. ONE shell renders both a leaf source and a
// category roll-up. Header: colour dot + title + live count + ▴/▾ delta + freshness
// dot/age. Body (glance): hero count + a tiny CSS sparkline from count history.
// Footer: attribution + the mirrored ◇ on-map toggle. Reads existing stores only.

import { getCatalogSource } from "@/lib/sources/catalog";
import { useSourceLive, toggleSourceMap } from "@/lib/sources/live";
import { useCountHistory, deltaOf, trendOf } from "@/lib/widgets/history";
import { constituentIds, rollupCount, rollupFresh } from "@/lib/widgets/rollup";
import { placementStore } from "@/lib/widgets/placement";
import { sourceKey, type WidgetDescriptor } from "@/lib/widgets/registry";
import { useSignalCounts } from "@/lib/signals/store";
import type { FreshKind } from "@/lib/sources/freshKind";

const FRESH_LABEL: Record<FreshKind, string> = {
  off: "off", unknown: "connecting…", live: "live", empty: "live · none now",
  lagging: "lagging", stale: "stale", down: "unavailable",
};

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 48, h = 14;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - p * h).toFixed(1)}`).join(" ");
  return (
    <svg className="tn-w-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function LeafBody({ id }: { id: string }) {
  const live = useSourceLive(id);
  const hist = useCountHistory(id);
  const delta = deltaOf(hist);
  if (!live.hasData) {
    return (
      <div className="tn-w-glance tn-w-off">
        <span className="tn-w-offnote">Off — enable on map to monitor</span>
        <button type="button" className="tn-w-enable" onClick={() => toggleSourceMap(id, true)}>Enable</button>
      </div>
    );
  }
  return (
    <div className="tn-w-glance">
      <span className="tn-w-count tn-num">{live.count == null ? "—" : live.count.toLocaleString()}</span>
      {delta !== 0 ? <span className={`tn-w-delta ${delta > 0 ? "up" : "down"}`}>{delta > 0 ? "▴" : "▾"}{Math.abs(delta)}</span> : null}
      <Sparkline points={trendOf(hist, 16)} />
    </div>
  );
}

function RollupBody({ group }: { group: string }) {
  const ids = constituentIds(group);
  const sigCounts = useSignalCounts();
  // NB: core counts aren't keyed in sigCounts; a roll-up that mixes core+signal shows
  // the signal portion here and the per-source rows below carry their own live count.
  const total = rollupCount(sigCounts as Record<string, number | undefined>, ids);
  return (
    <div className="tn-w-rollup">
      <div className="tn-w-glance">
        <span className="tn-w-count tn-num">{total == null ? "—" : total.toLocaleString()}</span>
        <span className="tn-w-sub">{ids.length} sources</span>
      </div>
      <ul className="tn-w-rows">
        {ids.map((id) => <RollupRow key={id} id={id} />)}
      </ul>
    </div>
  );
}

function RollupRow({ id }: { id: string }) {
  const s = getCatalogSource(id);
  const live = useSourceLive(id);
  if (!s) return null;
  return (
    <li className="tn-w-row">
      <span className="tn-w-rowdot" style={{ background: s.color }} />
      <span className="tn-w-rowname">{s.label}</span>
      <span className={`tn-fresh-dot tn-fresh-${live.fresh}`} aria-hidden />
      <span className="tn-w-rowcount tn-num">{live.count == null ? "—" : live.count.toLocaleString()}</span>
      <button
        type="button"
        className="tn-w-popout"
        title={`Pop out ${s.label} as its own widget`}
        onClick={() => placementStore.add(sourceKey(id))}
      >⤢</button>
    </li>
  );
}

export default function SourceWidget({ widget }: { widget: WidgetDescriptor }) {
  const isRollup = widget.kind === "rollup";
  const id = widget.ref;
  const source = isRollup ? undefined : getCatalogSource(id);
  // Header freshness: a leaf's own state, or a roll-up's worst-of (computed in body's rows;
  // here we show a neutral dot for roll-ups to avoid a second pass).
  const live = useSourceLive(isRollup ? "" : id);
  const fresh: FreshKind = isRollup ? rollupFresh([]) : live.fresh;
  return (
    <section className="tn-widget" aria-label={widget.title}>
      <header className="tn-widget-head">
        <span className="tn-widget-dot" style={{ background: source?.color ?? "var(--tn-accent)" }} />
        <span className="tn-widget-title">{widget.title}</span>
        <span className="tn-widget-spacer" />
        <span className={`tn-fresh-dot tn-fresh-${fresh}`} title={FRESH_LABEL[fresh]} aria-label={FRESH_LABEL[fresh]} />
        <button
          type="button"
          className="tn-widget-x"
          title="Remove widget"
          aria-label={`Remove ${widget.title}`}
          onClick={() => placementStore.remove(widget.key)}
        >×</button>
      </header>
      <div className="tn-widget-body">
        {isRollup ? <RollupBody group={id} /> : <LeafBody id={id} />}
      </div>
      <footer className="tn-widget-foot">
        <span className="tn-widget-attr">{source?.attribution ?? `${constituentIds(id).length} sources`}</span>
        {!isRollup && source ? (
          <button
            type="button"
            className="tn-widget-mapon"
            role="switch"
            aria-checked={live.mapOn}
            onClick={() => toggleSourceMap(id, !live.mapOn)}
          >◇ {live.mapOn ? "on map" : "off map"}</button>
        ) : null}
      </footer>
    </section>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors outside `.claude/worktrees`. Fix any type mismatch against the real store signatures before continuing.

- [ ] **Step 4: Commit**

```bash
git add lib/sources/live.ts components/shell/SourceWidget.tsx
git commit -m "feat(widgets): SourceWidget monitor shell (leaf + rollup) + live-state hook"
```

---

### Task 7: The Source Catalog (`components/shell/SourceCatalog.tsx`)

**Files:**
- Create: `components/shell/SourceCatalog.tsx`
- Modify: `lib/shell/panelRegistry.ts:17` (repoint `layerRail.component`)
- Test: none new (build-verified).

**Interfaces:**
- Consumes: Task 1 (`catalogByGroup`, `CatalogSource`), Task 4 (`sourceKey`), Task 5 (`placementStore`, `usePlacement`), Task 6 (`useSourceLive`, `toggleSourceMap`), existing `useNow`.
- Produces: `default export SourceCatalog()` — drop-in replacement for `LayerRail` in `PANEL_REGISTRY`.

- [ ] **Step 1: Implement the catalog**

```tsx
// components/shell/SourceCatalog.tsx
"use client";
// The unified control surface (evolves LayerRail). Every source is one row with TWO
// orthogonal toggles: ◇ Map (draw on the globe — the existing layers/signals store)
// and ▦ Widget (give it a grid tile — the placement store). Search + an X/Y-enabled
// counter (map axis). This is also the "add widget" tray. One piece of state per
// (source, axis): the ◇ toggle here is the SAME state as a widget's footer ◇ toggle.

import { useMemo, useState } from "react";
import { catalogByGroup, SOURCE_CATALOG, type CatalogSource } from "@/lib/sources/catalog";
import { useSourceLive, toggleSourceMap } from "@/lib/sources/live";
import { placementStore, usePlacement } from "@/lib/widgets/placement";
import { sourceKey } from "@/lib/widgets/registry";

function CatalogRow({ s }: { s: CatalogSource }) {
  const live = useSourceLive(s.id);
  const placed = usePlacement();
  const widgeted = placed.includes(sourceKey(s.id));
  return (
    <div className="tn-cat-row" style={{ opacity: live.mapOn || widgeted ? 1 : 0.6 }}>
      <span className="tn-cat-dot" style={{ background: s.color }} />
      <div className="tn-cat-main">
        <span className="tn-cat-name">{s.label}</span>
        <span className="tn-cat-attr">{s.attribution}</span>
      </div>
      <span className="tn-cat-count tn-num">{live.count == null ? "—" : live.count.toLocaleString()}</span>
      <button
        type="button"
        className="tn-cat-toggle"
        role="switch"
        aria-checked={live.mapOn}
        title={live.mapOn ? "On map — click to hide" : "Off map — click to show"}
        onClick={() => toggleSourceMap(s.id, !live.mapOn)}
        style={{ background: live.mapOn ? s.color : "var(--tn-toggle-off)" }}
      >◇</button>
      <button
        type="button"
        className="tn-cat-widget"
        aria-pressed={widgeted}
        title={widgeted ? "Remove widget" : "Add as a widget"}
        onClick={() => placementStore.toggle(sourceKey(s.id))}
      >{widgeted ? "▦" : "＋"}</button>
    </div>
  );
}

export default function SourceCatalog() {
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalogByGroup();
    return catalogByGroup()
      .map((g) => ({ group: g.group, sources: g.sources.filter((s) => s.label.toLowerCase().includes(needle) || s.group.toLowerCase().includes(needle)) }))
      .filter((g) => g.sources.length > 0);
  }, [q]);

  // X/Y enabled counter on the map axis (reads the same stores the rows read).
  const onMap = useSourceLive; // alias to keep the per-row hook; tally below via rows is heavy,
  // so compute a cheap tally from the live store snapshots inside a small child:
  if (!open) {
    return (
      <button type="button" className="tn-rail-fab" onClick={() => setOpen(true)} title="Show sources">
        <span className="tn-rail-fab-bars" aria-hidden>≡</span> Sources
      </button>
    );
  }
  return (
    <aside className="tn-rail tn-catalog" aria-label="Source catalog">
      <div className="tn-rail-header">
        <span className="tn-rail-title">Sources</span>
        <CatalogCounter />
        <button type="button" className="tn-rail-collapse" onClick={() => setOpen(false)} aria-label="Collapse sources">‹</button>
      </div>
      <input
        className="tn-cat-search"
        type="search"
        placeholder="Search sources…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search sources"
      />
      <div className="tn-cat-body">
        {groups.map((g) => (
          <div key={g.group} className="tn-rail-section">
            <div className="tn-subhead">{g.group}</div>
            {g.sources.map((s) => <CatalogRow key={s.id} s={s} />)}
          </div>
        ))}
      </div>
      <p className="tn-rail-foot">◇ draws on the globe · ＋ adds a monitor widget. Only sources on the map are fetched (widget-driven fetch lands in a later phase).</p>
    </aside>
  );
}

// Small child so the per-source live hooks don't all re-render the header.
function CatalogCounter() {
  const total = SOURCE_CATALOG.length;
  const on = SOURCE_CATALOG.filter((s) => useSourceLiveSafe(s.id)).length;
  return <span className="tn-cat-counter tn-num">{on}/{total} on</span>;
}
// Hooks can't be called in a filter callback; use a tiny fixed-order tally instead.
function useSourceLiveSafe(_id: string): boolean {
  return false; // placeholder removed in Step 2
}
```

> NOTE: Step 1 deliberately contains a counter stub that violates the Rules of Hooks
> (hooks in a filter). Step 2 replaces it with a correct implementation. Do not commit
> between Step 1 and Step 2.

- [ ] **Step 2: Fix the counter to obey the Rules of Hooks**

Replace the `CatalogCounter`, `useSourceLiveSafe`, and the unused `onMap` alias with a counter that reads the underlying stores directly (no per-source hook in a loop):

```tsx
// --- replace everything from "  const onMap = useSourceLive;" down to the end of file ---
  if (!open) {
    return (
      <button type="button" className="tn-rail-fab" onClick={() => setOpen(true)} title="Show sources">
        <span className="tn-rail-fab-bars" aria-hidden>≡</span> Sources
      </button>
    );
  }
  return (
    <aside className="tn-rail tn-catalog" aria-label="Source catalog">
      <div className="tn-rail-header">
        <span className="tn-rail-title">Sources</span>
        <CatalogCounter />
        <button type="button" className="tn-rail-collapse" onClick={() => setOpen(false)} aria-label="Collapse sources">‹</button>
      </div>
      <input
        className="tn-cat-search"
        type="search"
        placeholder="Search sources…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search sources"
      />
      <div className="tn-cat-body">
        {groups.map((g) => (
          <div key={g.group} className="tn-rail-section">
            <div className="tn-subhead">{g.group}</div>
            {g.sources.map((s) => <CatalogRow key={s.id} s={s} />)}
          </div>
        ))}
      </div>
      <p className="tn-rail-foot">◇ draws on the globe · ＋ adds a monitor widget. Only sources on the map are fetched (widget-driven fetch lands in a later phase).</p>
    </aside>
  );
}

// Counter reads the on/off stores DIRECTLY (one hook each, fixed order) — never a
// per-source hook in a loop.
function CatalogCounter() {
  const layers = useLayers();
  const sig = useSignals();
  const total = SOURCE_CATALOG.length;
  const on = SOURCE_CATALOG.filter((s) =>
    s.kind === "core" ? layers[s.id as LayerKey] === true : sig[s.id] === true
  ).length;
  return <span className="tn-cat-counter tn-num">{on}/{total} on</span>;
}
```

Add the imports this counter needs at the top of the file:

```tsx
import { useLayers, type LayerKey } from "@/lib/layers";
import { useSignals } from "@/lib/signals/store";
```

- [ ] **Step 3: Repoint the panel registry to the catalog**

In `lib/shell/panelRegistry.ts`, change the `layerRail` import + entry so the existing `PanelHost` mount renders the catalog:

```ts
// was: import LayerRail from "@/components/shell/LayerRail";
import SourceCatalog from "@/components/shell/SourceCatalog";
// ...
  layerRail:  { component: SourceCatalog,  title: "Sources",   category: "core",         defaultGrid: { x: 0, y: 0, w: 3, h: 8 } },
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors outside `.claude/worktrees`.

- [ ] **Step 5: Commit**

```bash
git add components/shell/SourceCatalog.tsx lib/shell/panelRegistry.ts
git commit -m "feat(shell): unified Source Catalog with map/widget toggles + search + counter"
```

---

### Task 8: Workspace host + wiring + styles (final integration)

**Files:**
- Create: `components/shell/Workspace.tsx`, `components/shell/WidgetHost.tsx`
- Modify: `components/shell/ConsoleShell.tsx` (mount `<Workspace/>` + hydrate placement), `app/globals.css` (widget/workspace styles)
- Test: full `vitest` + `npm run build`.

**Interfaces:**
- Consumes: Task 4 (`widgetForKey`), Task 5 (`usePlacement`, `placementStore`), Task 6 (`SourceWidget`).
- Produces: `default export Workspace()`, `WidgetHost({ widgetKey })`.

- [ ] **Step 1: Implement WidgetHost**

```tsx
// components/shell/WidgetHost.tsx
"use client";
// Resolves a placement key → its descriptor → the SourceWidget. A thin seam so the
// Workspace (and, in Phase 2, the rgl grid) renders by key without knowing widget kinds.

import { widgetForKey } from "@/lib/widgets/registry";
import SourceWidget from "@/components/shell/SourceWidget";

export default function WidgetHost({ widgetKey }: { widgetKey: string }) {
  const widget = widgetForKey(widgetKey);
  if (!widget) return null;
  return <SourceWidget widget={widget} />;
}
```

- [ ] **Step 2: Implement the minimal static Workspace**

```tsx
// components/shell/Workspace.tsx
"use client";
// Phase-1 host: a static flow of placed monitor widgets, docked over the still
// full-bleed globe (the map becomes a real grid tile in Phase 3). Renders nothing
// until the user adds a widget, so the calm default is unchanged. Drag/resize/save
// arrive in Phase 2 (react-grid-layout) — this seam (render-by-key) is what it wraps.

import { usePlacement } from "@/lib/widgets/placement";
import WidgetHost from "@/components/shell/WidgetHost";

export default function Workspace() {
  const keys = usePlacement();
  if (keys.length === 0) return null;
  return (
    <div className="tn-workspace" aria-label="Widget workspace">
      {keys.map((k) => (
        <div key={k} className="tn-tile">
          <WidgetHost widgetKey={k} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire into ConsoleShell**

In `components/shell/ConsoleShell.tsx`: import the Workspace + placement store, hydrate placement alongside the other stores, and render `<Workspace />` inside `.tn-shell` (after `<PanelHost />`).

```tsx
// add imports
import Workspace from "@/components/shell/Workspace";
import { placementStore } from "@/lib/widgets/placement";
```

```tsx
// inside the first useEffect, alongside the other *.hydrate() calls:
    placementStore.hydrate();
```

```tsx
// in the returned JSX, after <PanelHost />:
      <PanelHost />
      <Workspace />
```

- [ ] **Step 4: Add styles**

Append to `app/globals.css`:

```css
/* ── Widget workspace (Phase 1: static docked tiles over the globe) ── */
.tn-workspace {
  position: fixed;
  top: 56px;            /* clears the status bar */
  right: 12px;
  bottom: 40px;         /* clears the freshness ticker */
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  z-index: 30;
  pointer-events: none; /* let map drag through the gaps */
}
.tn-tile { pointer-events: auto; }

.tn-widget {
  background: var(--tn-panel, rgba(255,255,255,0.92));
  border: 1px solid var(--tn-border, rgba(0,0,0,0.08));
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  font-size: 12px;
}
.tn-widget-head { display: flex; align-items: center; gap: 7px; padding: 7px 9px; border-bottom: 1px solid var(--tn-border, rgba(0,0,0,0.06)); }
.tn-widget-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
.tn-widget-title { font-weight: 600; font-size: 13px; }
.tn-widget-spacer { flex: 1; }
.tn-widget-x, .tn-w-popout { border: none; background: none; cursor: pointer; color: var(--tn-muted, #64748b); font-size: 14px; line-height: 1; padding: 2px; }
.tn-widget-body { padding: 9px; }
.tn-w-glance { display: flex; align-items: baseline; gap: 8px; }
.tn-w-count { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tn-w-delta.up { color: #16a34a; } .tn-w-delta.down { color: #dc2626; }
.tn-w-spark { color: var(--tn-accent, #0e7d97); margin-left: auto; }
.tn-w-sub, .tn-w-offnote { color: var(--tn-muted, #64748b); font-size: 11px; }
.tn-w-off { flex-direction: column; align-items: flex-start; gap: 6px; }
.tn-w-enable { border: 1px solid var(--tn-border,#cbd5e1); background: none; border-radius: 6px; padding: 3px 8px; cursor: pointer; font-size: 11px; }
.tn-w-rows { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.tn-w-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.tn-w-rowdot { width: 7px; height: 7px; border-radius: 50%; }
.tn-w-rowname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tn-w-rowcount { font-variant-numeric: tabular-nums; }
.tn-widget-foot { display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-top: 1px solid var(--tn-border, rgba(0,0,0,0.06)); }
.tn-widget-attr { flex: 1; color: var(--tn-muted, #64748b); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tn-widget-mapon { border: none; background: none; cursor: pointer; color: var(--tn-muted,#64748b); font-size: 11px; }

/* Freshness dots — color + shape (filled/half/hollow) for colour-blind safety */
.tn-fresh-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: 0 0 auto; border: 1.5px solid transparent; }
.tn-fresh-live { background: #16a34a; }
.tn-fresh-empty { background: #16a34a; opacity: 0.55; }
.tn-fresh-lagging { background: #d97706; }
.tn-fresh-stale { background: #fff; border-color: #d97706; }
.tn-fresh-down { background: #fff; border-color: #dc2626; }
.tn-fresh-unknown, .tn-fresh-off { background: #fff; border-color: #94a3b8; }

/* Source catalog additions (reuses .tn-rail base) */
.tn-cat-search { width: 100%; box-sizing: border-box; margin: 6px 0 8px; padding: 6px 9px; border: 1px solid var(--tn-border,#cbd5e1); border-radius: 7px; font-size: 12px; }
.tn-cat-counter { margin-left: auto; margin-right: 8px; font-size: 11px; color: var(--tn-muted,#64748b); font-variant-numeric: tabular-nums; }
.tn-cat-row { display: flex; align-items: center; gap: 7px; padding: 5px 2px; }
.tn-cat-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
.tn-cat-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tn-cat-name { font-size: 12px; font-weight: 500; }
.tn-cat-attr { font-size: 10px; color: var(--tn-muted,#64748b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tn-cat-count { font-size: 11px; font-variant-numeric: tabular-nums; min-width: 38px; text-align: right; }
.tn-cat-toggle { width: 22px; height: 22px; border-radius: 6px; border: none; cursor: pointer; color: #fff; font-size: 12px; }
.tn-cat-widget { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--tn-border,#cbd5e1); background: none; cursor: pointer; font-size: 12px; }
```

- [ ] **Step 5: Type-check, run the full test suite, and build**

Run: `npx tsc --noEmit`
Expected: no errors outside `.claude/worktrees`.

Run: `npx vitest run`
Expected: **all green — baseline 152 + the 21 new tests added in Tasks 1–5 = 173 passing** (count may differ slightly; the point is zero failures and the new files are included).

Run (NOT while `next dev` is running): `npm run build`
Expected: build succeeds (ESLint clean — the authoritative gate).

- [ ] **Step 6: Manual smoke (optional but recommended)**

Run `npm run dev`, open the app: the Sources rail shows search + `X/Y on` counter + two toggles per row; clicking ＋ on a source adds a monitor widget that shows its live count/delta/freshness; ⤢ in a roll-up pops out a leaf; × removes a widget; reload preserves placed widgets. Stop `next dev` before any further `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add components/shell/Workspace.tsx components/shell/WidgetHost.tsx components/shell/ConsoleShell.tsx app/globals.css
git commit -m "feat(shell): minimal Workspace hosting placed monitor widgets over the globe"
```

---

## Self-Review

**1. Spec coverage (against §12 Phase 1 of the design spec):**
- `SOURCE_CATALOG` (core ⊕ signals) → Task 1. ✅
- Generic read-only `SourceWidget` (count + delta + freshness + attribution; glance body) → Task 6. ✅ (Severity per-event coloring + events-list body deferred to Phase 7 per spec — Phase 1 body is the scalar/glance mode; noted in `RollupBody`.)
- Tier-1 roll-ups + Tier-2 leaf pop-out → Task 4 (descriptors) + Task 6 (`RollupRow` ⤢ pop-out). ✅
- Two-toggle Catalog (evolve `LayerRail`) → Task 7. ✅
- Minimal static `Workspace` (drag deferred) → Task 8. ✅
- No new pollers (reads existing stores) → enforced in Task 6 (`useSourceLive` only reads stores; `live.count != null` history feed is local). ✅
- Map stays full-bleed (coexistence) → Task 8 (`.tn-workspace` is a fixed docked panel; map untouched). ✅

**2. Placeholder scan:** No TBD/TODO. Task 7 Step 1 intentionally ships a hooks-violating counter stub that Step 2 replaces (flagged with a do-not-commit note + full replacement code) — this is a real, complete two-step edit, not a placeholder.

**3. Type consistency:** `CatalogSource`, `FreshKind`, `WidgetDescriptor`, `SourceLive`, `CountSample` are defined once and consumed with matching shapes. Store reads match the verified signatures (`metricsStore`/`Metrics`, `freshnessStore`/`SourceRecord`/`classifyFreshness`, `signalCountsStore`, `signalsStore`/`layersStore`, `classifySignalFreshness({...raw, refreshMs})`). `toggleSourceMap` uses `layersStore.set(LayerKey, on)` / `signalsStore.set(id, on)` — both exist. `placementStore.toggle/add/remove/has/hydrate` all used consistently.

**Known Phase-1 limitations (intentional, deferred per spec):** (a) a placed signal-source widget whose map layer is OFF shows "Off — enable to monitor" because widget-driven fetch is Phase 4; (b) roll-up header freshness shows a neutral dot (worst-of across rows is shown per-row) — full worst-of header rollup is a Phase-2 polish; (c) core-layer counts aren't summed into a mixed roll-up's hero total (signal portion only) — acceptable since per-source rows carry their own counts. None block the Phase-1 deliverable.

---

## Execution Handoff

(Provided by the assistant after this plan is saved.)
