# Widget Console Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the TrafficNerd UI as a composable monitoring console — a fixed centre stage (3D/2D map · world clock) surrounded by three resizable, collapsible, scrollable segments holding multi-instance category-card widgets, added via ⌘K, swapped wholesale by presets.

**Architecture:** A new `lib/console/` owns pure logic (layout types + reducers + a `useSyncExternalStore` store + widget registry + alert model + presets + URL codec). A new `components/console/` owns the shell (segments, stage host, widget frame) and the four widgets. Pure logic is TDD'd in vitest (node). UI is gated by Playwright e2e + a real `next dev` run. Existing pieces are reused, not rewritten: `usePlanes`, `useEventFeeds`/`projectEventFeed`, `loadedCamerasStore`/`CameraVideo`, `WorldMap` (its projection already follows `viewModeStore`), the ⌘K palette, `CinematicDive`/`FeedOverlay`.

**Tech Stack:** Next 15.5 (App Router), React 19, TypeScript 5.7, MapLibre GL 5, hls.js, vitest 2.1 (node), Playwright. **Zero new runtime dependencies** — widget drag uses native HTML5 DnD, segment/widget resize uses pointer events.

**Spec:** `docs/superpowers/specs/2026-06-28-widget-console-redesign-design.md`

## Global Constraints

- React 19.0.0 / Next 15.5.19 — no version changes.
- **Zero new runtime dependencies.** Reuse hls.js, maplibre-gl; native DnD + pointer-event resize.
- **Hard cap: 50 widget instances total** across all segments (`MAX_WIDGETS = 50`).
- Stores follow the existing pattern: framework-light `useSyncExternalStore` singletons with `get/subscribe/emit`, persisted via `@/lib/shell/persist` (`loadPersisted`/`savePersisted`, both window-guarded — no-op in node).
- Persistence keys: `tn.console.v1` (layout), `tn.console.presets.v1` (custom presets). Bump version ints on shape changes.
- CSS classes are namespaced `tn-…`; calm light theme (CSS vars already in `app/globals.css`).
- Video widgets **muted by default**; click to unmute.
- Widget config is **per-instance** (filter/sort, channel, alert style live in `WidgetInstance.config`).
- Presets **replace** the whole arrangement.
- Every task ends green: `npx tsc --noEmit` clean, `npm test` green, and (for UI tasks) `npm run e2e` for the new spec green.
- Pure logic lives in `.ts` files with **no React imports** so vitest (node env) can test it.

---

## File Structure

**New — pure logic (`lib/console/`)**
- `types.ts` — `SegmentId`, `StageId`, `WidgetTypeId`, `WidgetInstance`, `ShellLayout`, `MAX_WIDGETS`, `createDefaultLayout()`.
- `reducers.ts` — pure layout transforms (add/remove/move/reorder/resize/collapse/segment ops/stage/config).
- `store.ts` — `shellLayoutStore` (persist `tn.console.v1`) + `useShellLayout()`.
- `registry.ts` — `WidgetType`, `registerWidget`, `getWidgetType`, `listWidgetTypes`, `widgetsByCategory`.
- `alerts.ts` — `Alert`, `AlertRule`, `runAlertRule`.
- `presets.ts` — `ConsolePreset`, built-ins, `applyPreset`, custom-preset store.
- `share.ts` — `encodeLayout`/`decodeLayout` (URL param `c=`).
- `news/providers.ts` — provider catalogue + `parseCustomStream` + `resolvePlayable`.
- `widgets/aviation.tsx`, `widgets/events.tsx`, `widgets/cameras.tsx`, `widgets/news.tsx` — descriptor + alert rules (pure, in sibling `*.rules.ts`) + body component + self-registration.

**New — components (`components/console/`)**
- `WidgetFrame.tsx` — shared card chrome.
- `Segment.tsx` — one droppable scrollable segment.
- `ConsoleWorkspace.tsx` — the three segments + centre column + grips/resize/collapse.
- `StageHost.tsx` — renders map (3D/2D) or clock per `stage`.
- `WorldClock.tsx` — clock stage widget.
- `StageSwitch.tsx` — the 3D/2D/🕐 top-bar control.

**Modified**
- `components/shell/CommandPalette.tsx` — add widget-catalog + stage + preset commands.
- `components/shell/ConsoleShell.tsx` — render `<ConsoleWorkspace/>` as the body; keep hydration, ⌘K, overlays; drop the console/explore split.
- `app/page.tsx` — mount the new shell (map import moves into `StageHost`).
- `lib/console/widgets/index.ts` — import all four widgets so they self-register.

**Tests**
- `tests/unit/console-reducers.test.ts`, `console-store.test.ts`, `console-registry.test.ts`, `console-alerts.test.ts`, `console-aviation.test.ts`, `console-events.test.ts`, `console-cameras.test.ts`, `console-news-providers.test.ts`, `console-presets.test.ts`, `console-share.test.ts`.
- `tests/e2e/console.spec.ts` — shell resize/collapse/scroll, add/move/remove widget, stage swap, preset apply.

---

## Phase A — Core model & store (pure logic)

### Task 1: Layout types + defaults

**Files:**
- Create: `lib/console/types.ts`
- Test: `tests/unit/console-reducers.test.ts` (shared file, starts here)

**Interfaces:**
- Produces: `SegmentId = "left"|"right"|"bottom"`; `StageId = "map3d"|"map2d"|"clock"`; `WidgetTypeId = string`; `WidgetInstance { id:string; type:WidgetTypeId; segment:SegmentId; order:number; height:number; collapsed:boolean; config:Record<string,unknown> }`; `ShellLayout { segments:Record<SegmentId,{size:number;collapsed:boolean}>; stage:StageId; widgets:WidgetInstance[] }`; `MAX_WIDGETS = 50`; `createDefaultLayout(): ShellLayout`; `newInstanceId(seq:number): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/console-reducers.test.ts
import { expect, test } from "vitest";
import { createDefaultLayout, MAX_WIDGETS } from "@/lib/console/types";

test("default layout has three segments, a 2D stage, and no widgets", () => {
  const l = createDefaultLayout();
  expect(Object.keys(l.segments).sort()).toEqual(["bottom", "left", "right"]);
  expect(l.segments.left).toEqual({ size: 320, collapsed: false });
  expect(l.segments.bottom).toEqual({ size: 240, collapsed: false });
  expect(l.stage).toBe("map2d");
  expect(l.widgets).toEqual([]);
  expect(MAX_WIDGETS).toBe(50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- console-reducers`
Expected: FAIL — cannot find module `@/lib/console/types`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/console/types.ts
export type SegmentId = "left" | "right" | "bottom";
export type StageId = "map3d" | "map2d" | "clock";
export type WidgetTypeId = string;

export interface WidgetInstance {
  id: string;
  type: WidgetTypeId;
  segment: SegmentId;
  order: number;
  height: number;       // px; user-resizable
  collapsed: boolean;   // header-only
  config: Record<string, unknown>;
}

export interface SegmentState { size: number; collapsed: boolean }

export interface ShellLayout {
  segments: Record<SegmentId, SegmentState>;
  stage: StageId;
  widgets: WidgetInstance[];
}

export const MAX_WIDGETS = 50;

export function createDefaultLayout(): ShellLayout {
  return {
    segments: {
      left: { size: 320, collapsed: false },
      right: { size: 320, collapsed: false },
      bottom: { size: 240, collapsed: false },
    },
    stage: "map2d",
    widgets: [],
  };
}

/** Deterministic id (no Math.random — keeps reducers pure/testable). */
export function newInstanceId(seq: number): string {
  return `w${seq.toString(36)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- console-reducers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/console/types.ts tests/unit/console-reducers.test.ts
git commit -m "feat(console): shell layout types + default layout"
```

---

### Task 2: Pure layout reducers

**Files:**
- Create: `lib/console/reducers.ts`
- Test: `tests/unit/console-reducers.test.ts` (extend)

**Interfaces:**
- Consumes: `ShellLayout`, `WidgetInstance`, `SegmentId`, `StageId`, `MAX_WIDGETS`, `newInstanceId` from `types.ts`.
- Produces (all `(layout, …) => ShellLayout`, pure, never mutate input):
  - `addWidget(l, type, instanceId, opts?:{segment?:SegmentId; config?:Record<string,unknown>; height?:number}): ShellLayout` — appends to the chosen segment (default = segment with fewest widgets, tie → "left"); **no-op (returns same `l`) when `l.widgets.length >= MAX_WIDGETS`**.
  - `removeWidget(l, id): ShellLayout`
  - `moveWidget(l, id, toSegment, toIndex): ShellLayout` — reindexes `order` densely in both segments.
  - `setWidgetHeight(l, id, height): ShellLayout` — clamps `height` to `[120, 1200]`.
  - `setWidgetCollapsed(l, id, collapsed): ShellLayout`
  - `setWidgetConfig(l, id, patch): ShellLayout` — shallow-merges into `config`.
  - `setSegmentSize(l, seg, size): ShellLayout` — clamps `[0, 900]`.
  - `setSegmentCollapsed(l, seg, collapsed): ShellLayout`
  - `setStage(l, stage): ShellLayout`
  - `widgetsInSegment(l, seg): WidgetInstance[]` — sorted by `order`.
  - `isAtCapacity(l): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// append to tests/unit/console-reducers.test.ts
import {
  addWidget, removeWidget, moveWidget, setWidgetHeight, setSegmentSize,
  setStage, widgetsInSegment, isAtCapacity,
} from "@/lib/console/reducers";
import { newInstanceId } from "@/lib/console/types";

test("addWidget appends to the emptiest segment and assigns dense order", () => {
  let l = createDefaultLayout();
  l = addWidget(l, "aviation", "a");
  l = addWidget(l, "events", "b", { segment: "left" });
  expect(widgetsInSegment(l, "left").map((w) => w.id)).toEqual(["a", "b"]);
  expect(widgetsInSegment(l, "left").map((w) => w.order)).toEqual([0, 1]);
});

test("addWidget is a no-op at capacity", () => {
  let l = createDefaultLayout();
  for (let i = 0; i < 50; i++) l = addWidget(l, "aviation", newInstanceId(i));
  expect(l.widgets.length).toBe(50);
  expect(isAtCapacity(l)).toBe(true);
  const same = addWidget(l, "aviation", "overflow");
  expect(same).toBe(l); // identity — caller can detect rejection
});

test("moveWidget re-segments and densely reindexes order", () => {
  let l = createDefaultLayout();
  l = addWidget(l, "aviation", "a", { segment: "left" });
  l = addWidget(l, "events", "b", { segment: "left" });
  l = moveWidget(l, "a", "right", 0);
  expect(widgetsInSegment(l, "left").map((w) => w.id)).toEqual(["b"]);
  expect(widgetsInSegment(l, "right").map((w) => w.id)).toEqual(["a"]);
  expect(widgetsInSegment(l, "left")[0].order).toBe(0);
});

test("setWidgetHeight clamps; setSegmentSize clamps; setStage swaps", () => {
  let l = addWidget(createDefaultLayout(), "aviation", "a");
  l = setWidgetHeight(l, "a", 5);
  expect(l.widgets[0].height).toBe(120);
  l = setSegmentSize(l, "left", -10);
  expect(l.segments.left.size).toBe(0);
  l = setStage(l, "clock");
  expect(l.stage).toBe("clock");
});

test("removeWidget drops the instance and leaves others intact", () => {
  let l = addWidget(addWidget(createDefaultLayout(), "aviation", "a"), "events", "b");
  l = removeWidget(l, "a");
  expect(l.widgets.map((w) => w.id)).toEqual(["b"]);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-reducers`
Expected: FAIL — cannot find module `@/lib/console/reducers`.

- [ ] **Step 3: Implement**

```ts
// lib/console/reducers.ts
import type { ShellLayout, WidgetInstance, SegmentId, StageId } from "@/lib/console/types";
import { MAX_WIDGETS } from "@/lib/console/types";

const SEGMENTS: SegmentId[] = ["left", "right", "bottom"];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function widgetsInSegment(l: ShellLayout, seg: SegmentId): WidgetInstance[] {
  return l.widgets.filter((w) => w.segment === seg).sort((a, b) => a.order - b.order);
}
export function isAtCapacity(l: ShellLayout): boolean {
  return l.widgets.length >= MAX_WIDGETS;
}

function emptiestSegment(l: ShellLayout): SegmentId {
  let best: SegmentId = "left";
  let min = Infinity;
  for (const s of SEGMENTS) {
    const n = l.widgets.filter((w) => w.segment === s).length;
    if (n < min) { min = n; best = s; }
  }
  return best;
}

export function addWidget(
  l: ShellLayout, type: string, instanceId: string,
  opts: { segment?: SegmentId; config?: Record<string, unknown>; height?: number } = {},
): ShellLayout {
  if (isAtCapacity(l)) return l;
  const segment = opts.segment ?? emptiestSegment(l);
  const order = l.widgets.filter((w) => w.segment === segment).length;
  const inst: WidgetInstance = {
    id: instanceId, type, segment, order,
    height: opts.height ?? 260, collapsed: false, config: opts.config ?? {},
  };
  return { ...l, widgets: [...l.widgets, inst] };
}

export function removeWidget(l: ShellLayout, id: string): ShellLayout {
  return { ...l, widgets: l.widgets.filter((w) => w.id !== id) };
}

export function moveWidget(l: ShellLayout, id: string, toSegment: SegmentId, toIndex: number): ShellLayout {
  const moving = l.widgets.find((w) => w.id === id);
  if (!moving) return l;
  const from = widgetsInSegment(l, moving.segment).filter((w) => w.id !== id);
  const to = toSegment === moving.segment ? from : widgetsInSegment(l, toSegment);
  const idx = clamp(toIndex, 0, to.length);
  const nextTo = [...to.slice(0, idx), { ...moving, segment: toSegment }, ...to.slice(idx)];
  const reindex = (arr: WidgetInstance[], seg: SegmentId) => arr.map((w, i) => ({ ...w, segment: seg, order: i }));
  const untouched = l.widgets.filter((w) => w.segment !== moving.segment && w.segment !== toSegment);
  const rebuilt = toSegment === moving.segment
    ? reindex(nextTo, toSegment)
    : [...reindex(from, moving.segment), ...reindex(nextTo, toSegment)];
  return { ...l, widgets: [...untouched, ...rebuilt] };
}

export function setWidgetHeight(l: ShellLayout, id: string, height: number): ShellLayout {
  return { ...l, widgets: l.widgets.map((w) => w.id === id ? { ...w, height: clamp(height, 120, 1200) } : w) };
}
export function setWidgetCollapsed(l: ShellLayout, id: string, collapsed: boolean): ShellLayout {
  return { ...l, widgets: l.widgets.map((w) => w.id === id ? { ...w, collapsed } : w) };
}
export function setWidgetConfig(l: ShellLayout, id: string, patch: Record<string, unknown>): ShellLayout {
  return { ...l, widgets: l.widgets.map((w) => w.id === id ? { ...w, config: { ...w.config, ...patch } } : w) };
}
export function setSegmentSize(l: ShellLayout, seg: SegmentId, size: number): ShellLayout {
  return { ...l, segments: { ...l.segments, [seg]: { ...l.segments[seg], size: clamp(size, 0, 900) } } };
}
export function setSegmentCollapsed(l: ShellLayout, seg: SegmentId, collapsed: boolean): ShellLayout {
  return { ...l, segments: { ...l.segments, [seg]: { ...l.segments[seg], collapsed } } };
}
export function setStage(l: ShellLayout, stage: StageId): ShellLayout {
  return { ...l, stage };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-reducers`
Expected: PASS (all reducer tests).

- [ ] **Step 5: Commit**

```bash
git add lib/console/reducers.ts tests/unit/console-reducers.test.ts
git commit -m "feat(console): pure layout reducers (add/move/resize/stage, 50-cap)"
```

---

### Task 3: shellLayoutStore

**Files:**
- Create: `lib/console/store.ts`
- Test: `tests/unit/console-store.test.ts`

**Interfaces:**
- Consumes: reducers from Task 2; `createDefaultLayout`, `ShellLayout` from Task 1; `loadPersisted`/`savePersisted` from `@/lib/shell/persist`.
- Produces: `shellLayoutStore` with `{ get(): ShellLayout; set(l): void; subscribe(fn): ()=>void; hydrate(): void; replace(l): void; add(type, opts?): {ok:boolean; id?:string}; remove(id); move(id, seg, idx); resizeWidget(id, h); setSegment(seg, size); collapseSegment(seg, c); stage(s): void; configure(id, patch) }`; hook `useShellLayout(): ShellLayout` (ids minted internally).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/console-store.test.ts
import { afterEach, expect, test } from "vitest";
import { shellLayoutStore } from "@/lib/console/store";
import { createDefaultLayout } from "@/lib/console/types";

afterEach(() => shellLayoutStore.replace(createDefaultLayout()));

test("add returns the new id and lands the widget", () => {
  const r = shellLayoutStore.add("aviation", { segment: "left" });
  expect(r.ok).toBe(true);
  expect(shellLayoutStore.get().widgets.find((w) => w.id === r.id)?.type).toBe("aviation");
});

test("add past 50 is rejected with ok:false", () => {
  for (let i = 0; i < 50; i++) shellLayoutStore.add("aviation");
  const r = shellLayoutStore.add("aviation");
  expect(r.ok).toBe(false);
  expect(shellLayoutStore.get().widgets.length).toBe(50);
});

test("subscribers fire on mutation", () => {
  let n = 0;
  const unsub = shellLayoutStore.subscribe(() => n++);
  shellLayoutStore.add("events");
  shellLayoutStore.stage("clock");
  unsub();
  shellLayoutStore.add("events"); // not counted
  expect(n).toBe(2);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-store`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/console/store.ts
"use client";
import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { createDefaultLayout, type ShellLayout, type SegmentId, type StageId } from "@/lib/console/types";
import * as R from "@/lib/console/reducers";

const KEY = "tn.console.v1";
const VERSION = 1;

let state: ShellLayout = createDefaultLayout();
let seq = 0;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); savePersisted(KEY, VERSION, state); }
function nextId(): string { seq += 1; return `w${Date.now().toString(36)}${seq.toString(36)}`; }

export const shellLayoutStore = {
  get(): ShellLayout { return state; },
  set(l: ShellLayout) { state = l; emit(); },
  replace(l: ShellLayout) { state = l; emit(); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  hydrate() { const s = loadPersisted<ShellLayout>(KEY, VERSION); if (s) state = s; emit(); },
  add(type: string, opts: { segment?: SegmentId; config?: Record<string, unknown>; height?: number } = {}) {
    if (R.isAtCapacity(state)) return { ok: false as const };
    const id = nextId();
    state = R.addWidget(state, type, id, opts); emit();
    return { ok: true as const, id };
  },
  remove(id: string) { state = R.removeWidget(state, id); emit(); },
  move(id: string, seg: SegmentId, idx: number) { state = R.moveWidget(state, id, seg, idx); emit(); },
  resizeWidget(id: string, h: number) { state = R.setWidgetHeight(state, id, h); emit(); },
  collapseWidget(id: string, c: boolean) { state = R.setWidgetCollapsed(state, id, c); emit(); },
  configure(id: string, patch: Record<string, unknown>) { state = R.setWidgetConfig(state, id, patch); emit(); },
  setSegment(seg: SegmentId, size: number) { state = R.setSegmentSize(state, seg, size); emit(); },
  collapseSegment(seg: SegmentId, c: boolean) { state = R.setSegmentCollapsed(state, seg, c); emit(); },
  stage(s: StageId) { state = R.setStage(state, s); emit(); },
};

export function useShellLayout(): ShellLayout {
  return useSyncExternalStore(shellLayoutStore.subscribe, shellLayoutStore.get, shellLayoutStore.get);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/console/store.ts tests/unit/console-store.test.ts
git commit -m "feat(console): shellLayoutStore (persist + capacity-aware add)"
```

---

## Phase B — Widget framework

### Task 4: Widget type registry

**Files:**
- Create: `lib/console/registry.ts`
- Test: `tests/unit/console-registry.test.ts`

**Interfaces:**
- Consumes: `Alert`, `AlertRule` (forward ref to Task 5 — `registry.ts` imports the types only).
- Produces: `WidgetType { id; title; icon:string; category:string; defaultHeight:number; defaultConfig:Record<string,unknown>; component: ComponentType<WidgetBodyProps>; capabilities?:{filter?:boolean;sort?:boolean} }`; `WidgetBodyProps { instanceId:string; config:Record<string,unknown> }`; `registerWidget(t)`, `getWidgetType(id)`, `listWidgetTypes()`, `widgetsByCategory(): {category:string; types:WidgetType[]}[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/console-registry.test.ts
import { expect, test, beforeEach } from "vitest";
import { registerWidget, getWidgetType, listWidgetTypes, widgetsByCategory, __resetRegistry } from "@/lib/console/registry";

const stub = (id: string, category: string) =>
  ({ id, title: id, icon: "■", category, defaultHeight: 200, defaultConfig: {}, component: (() => null) as never });

beforeEach(() => __resetRegistry());

test("register + get + list", () => {
  registerWidget(stub("aviation", "Aviation"));
  expect(getWidgetType("aviation")?.title).toBe("aviation");
  expect(listWidgetTypes().map((t) => t.id)).toEqual(["aviation"]);
});

test("widgetsByCategory groups and preserves insertion order", () => {
  registerWidget(stub("aviation", "Aviation"));
  registerWidget(stub("news", "News"));
  registerWidget(stub("emerg", "Aviation"));
  const groups = widgetsByCategory();
  expect(groups.map((g) => g.category)).toEqual(["Aviation", "News"]);
  expect(groups[0].types.map((t) => t.id)).toEqual(["aviation", "emerg"]);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-registry`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/console/registry.ts
import type { ComponentType } from "react";

export interface WidgetBodyProps { instanceId: string; config: Record<string, unknown> }

export interface WidgetType {
  id: string;
  title: string;
  icon: string;
  category: string;
  defaultHeight: number;
  defaultConfig: Record<string, unknown>;
  component: ComponentType<WidgetBodyProps>;
  capabilities?: { filter?: boolean; sort?: boolean };
}

const reg = new Map<string, WidgetType>();

export function registerWidget(t: WidgetType): void { reg.set(t.id, t); }
export function getWidgetType(id: string): WidgetType | undefined { return reg.get(id); }
export function listWidgetTypes(): WidgetType[] { return [...reg.values()]; }
export function widgetsByCategory(): { category: string; types: WidgetType[] }[] {
  const order: string[] = [];
  const byCat = new Map<string, WidgetType[]>();
  for (const t of reg.values()) {
    if (!byCat.has(t.category)) { byCat.set(t.category, []); order.push(t.category); }
    byCat.get(t.category)!.push(t);
  }
  return order.map((category) => ({ category, types: byCat.get(category)! }));
}
/** Test-only: clear the singleton registry between tests. */
export function __resetRegistry(): void { reg.clear(); }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-registry`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/console/registry.ts tests/unit/console-registry.test.ts
git commit -m "feat(console): widget type registry + category grouping"
```

---

### Task 5: Alert model

**Files:**
- Create: `lib/console/alerts.ts`
- Test: `tests/unit/console-alerts.test.ts`

**Interfaces:**
- Produces: `AlertSeverity = "info"|"warn"|"critical"`; `Alert { id:string; severity:AlertSeverity; text:string; ts?:number; ref?:string }`; `AlertRule<T> = (items:T[], config:Record<string,unknown>) => Alert[]`; `runAlertRule<T>(rule, items, config): Alert[]` (returns `[]` if rule throws — a widget's data hiccup must never crash the frame); `alertCount(alerts): number`; `topSeverity(alerts): AlertSeverity|null`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/console-alerts.test.ts
import { expect, test } from "vitest";
import { runAlertRule, topSeverity, type Alert } from "@/lib/console/alerts";

test("runAlertRule passes through results", () => {
  const rule = (xs: number[]): Alert[] => xs.filter((n) => n > 5).map((n) => ({ id: `a${n}`, severity: "warn", text: `${n}` }));
  expect(runAlertRule(rule, [1, 9], {}).map((a) => a.id)).toEqual(["a9"]);
});

test("runAlertRule swallows rule errors", () => {
  const boom = () => { throw new Error("bad data"); };
  expect(runAlertRule(boom, [], {})).toEqual([]);
});

test("topSeverity ranks critical > warn > info", () => {
  expect(topSeverity([{ id: "1", severity: "info", text: "" }, { id: "2", severity: "critical", text: "" }])).toBe("critical");
  expect(topSeverity([])).toBeNull();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-alerts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/console/alerts.ts
export type AlertSeverity = "info" | "warn" | "critical";
export interface Alert { id: string; severity: AlertSeverity; text: string; ts?: number; ref?: string }
export type AlertRule<T> = (items: T[], config: Record<string, unknown>) => Alert[];

const RANK: Record<AlertSeverity, number> = { info: 0, warn: 1, critical: 2 };

export function runAlertRule<T>(rule: AlertRule<T>, items: T[], config: Record<string, unknown>): Alert[] {
  try { return rule(items, config); } catch { return []; }
}
export function alertCount(alerts: Alert[]): number { return alerts.length; }
export function topSeverity(alerts: Alert[]): AlertSeverity | null {
  if (alerts.length === 0) return null;
  return alerts.reduce((top, a) => (RANK[a.severity] > RANK[top] ? a.severity : top), "info" as AlertSeverity);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-alerts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/console/alerts.ts tests/unit/console-alerts.test.ts
git commit -m "feat(console): alert model (rules, error-safe runner, severity rank)"
```

---

### Task 6: WidgetFrame component

**Files:**
- Create: `components/console/WidgetFrame.tsx`
- Test: `tests/e2e/console.spec.ts` (started; full shell e2e completes in Task 15)

**Interfaces:**
- Consumes: `shellLayoutStore` (Task 3), `Alert`/`topSeverity` (Task 5), `getWidgetType` (Task 4).
- Produces: default export `WidgetFrame({ instance }: { instance: WidgetInstance })` rendering the type's component; props for body via `WidgetBodyProps`. Body widgets report alerts/count/freshness up through a context: `useWidgetReport(): (r:{ alerts:Alert[]; count?:number; freshLabel?:string })=>void` — the frame provides it; bodies call it in an effect.

- [ ] **Step 1: Implement the frame (UI — gated by e2e + tsc)**

```tsx
// components/console/WidgetFrame.tsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import type { WidgetInstance } from "@/lib/console/types";
import { shellLayoutStore } from "@/lib/console/store";
import { getWidgetType } from "@/lib/console/registry";
import { topSeverity, type Alert } from "@/lib/console/alerts";

interface Report { alerts: Alert[]; count?: number; freshLabel?: string }
const ReportCtx = createContext<(r: Report) => void>(() => {});
export function useWidgetReport() { return useContext(ReportCtx); }

export default function WidgetFrame({ instance }: { instance: WidgetInstance }) {
  const type = getWidgetType(instance.type);
  const [report, setReport] = useState<Report>({ alerts: [] });
  const [menuOpen, setMenuOpen] = useState(false);
  const onReport = useCallback((r: Report) => setReport(r), []);
  if (!type) return null;
  const Body = type.component;
  const sev = topSeverity(report.alerts);
  const alertStyle = (instance.config.alertStyle as string) ?? "top"; // "top" | "feed"

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/tn-widget", instance.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY, startH = instance.height;
    const move = (ev: PointerEvent) => shellLayoutStore.resizeWidget(instance.id, startH + (ev.clientY - startY));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  return (
    <div className="tn-cw" data-widget-type={instance.type} style={{ height: instance.collapsed ? undefined : instance.height }}>
      <header className="tn-cw-head" draggable onDragStart={onDragStart}>
        <span className="tn-cw-icon">{type.icon}</span>
        <span className="tn-cw-title">{type.title}</span>
        {report.count != null && <span className="tn-cw-count">{report.count}</span>}
        <span className="tn-cw-sp" />
        {report.alerts.length > 0 && <span className={`tn-cw-badge tn-sev-${sev}`}>{report.alerts.length}</span>}
        {report.freshLabel && <span className="tn-cw-fresh">{report.freshLabel}</span>}
        <button className="tn-cw-menu" aria-label="Widget menu" onClick={() => setMenuOpen((o) => !o)}>⋯</button>
      </header>

      {menuOpen && (
        <div className="tn-cw-menu-pop" role="menu">
          <button onClick={() => { shellLayoutStore.add(instance.type, { config: { ...instance.config } }); setMenuOpen(false); }}>⧉ Duplicate</button>
          <button onClick={() => { shellLayoutStore.configure(instance.id, { alertStyle: alertStyle === "top" ? "feed" : "top" }); setMenuOpen(false); }}>
            ⚡ Alerts: {alertStyle === "top" ? "on top" : "in feed"}
          </button>
          <button className="tn-cw-danger" onClick={() => shellLayoutStore.remove(instance.id)}>✕ Remove</button>
        </div>
      )}

      {!instance.collapsed && (
        <>
          {alertStyle === "top" && report.alerts.length > 0 && (
            <div className="tn-cw-attn">
              <div className="tn-cw-attn-h">Needs attention · {report.alerts.length}</div>
              {report.alerts.slice(0, 4).map((a) => (
                <div key={a.id} className={`tn-cw-alert tn-sev-${a.severity}`}>{a.text}</div>
              ))}
            </div>
          )}
          <div className="tn-cw-body">
            <ReportCtx.Provider value={onReport}><Body instanceId={instance.id} config={instance.config} /></ReportCtx.Provider>
          </div>
          <div className="tn-cw-resize" onPointerDown={onResizePointerDown} title="Drag to resize" />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the namespaced styles**

Append to `app/globals.css` (calm light; mirror existing `.tn-…` vars):

```css
.tn-cw{display:flex;flex-direction:column;background:#fff;border:1px solid var(--tn-border,#dbe2ea);border-radius:8px;overflow:hidden}
.tn-cw-head{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid #f1f5f9;cursor:grab;font-size:12px}
.tn-cw-title{font-weight:700;color:#2b3640}.tn-cw-count{font-size:11px;color:#8a97a6}.tn-cw-sp{flex:1}
.tn-cw-badge{font-size:10px;font-weight:800;color:#fff;border-radius:8px;padding:0 5px;background:#8a97a6}
.tn-cw-badge.tn-sev-critical{background:#d9534f}.tn-cw-badge.tn-sev-warn{background:#d9882f}.tn-cw-badge.tn-sev-info{background:#4a78c9}
.tn-cw-fresh{font-size:10px;color:#3f8f5c}.tn-cw-menu{border:0;background:none;cursor:pointer;color:#b3bdc8;font-size:14px}
.tn-cw-menu-pop{display:flex;flex-direction:column;border-bottom:1px solid #eef2f6}
.tn-cw-menu-pop button{text-align:left;border:0;background:none;padding:7px 10px;font-size:12px;cursor:pointer}
.tn-cw-menu-pop button:hover{background:#f6f9fb}.tn-cw-danger{color:#d9534f}
.tn-cw-attn{border-bottom:1px solid #f1f5f9}.tn-cw-attn-h{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#a9b4bf;padding:5px 8px 2px}
.tn-cw-alert{font-size:11px;padding:4px 8px;border-left:3px solid #d9534f;background:#fdf3f2}
.tn-cw-alert.tn-sev-warn{border-left-color:#d9882f;background:#fdf7ee}.tn-cw-alert.tn-sev-info{border-left-color:#4a78c9;background:#f1f5fc}
.tn-cw-body{flex:1;overflow:auto;min-height:0}
.tn-cw-resize{height:6px;cursor:row-resize;background:linear-gradient(#f1f5f9,#fff)}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `components/console/WidgetFrame.tsx` (a "no widgets registered" runtime is fine; e2e covers behavior after Task 15).

- [ ] **Step 4: Commit**

```bash
git add components/console/WidgetFrame.tsx app/globals.css
git commit -m "feat(console): WidgetFrame chrome (header, alerts strip, menu, resize, drag)"
```

---

## Phase C — Shell

### Task 7: Segment + ConsoleWorkspace

**Files:**
- Create: `components/console/Segment.tsx`, `components/console/ConsoleWorkspace.tsx`
- Test: `tests/e2e/console.spec.ts` (extend in Task 15)

**Interfaces:**
- Consumes: `useShellLayout`, `shellLayoutStore`, `widgetsInSegment` (import from reducers), `WidgetFrame`, `StageHost` (Task 8).
- Produces: `Segment({ id }: { id: SegmentId })` — a scrollable drop zone rendering its widgets; `ConsoleWorkspace()` — the flex shell wiring the three segments + centre column + pointer-drag grips.

- [ ] **Step 1: Implement Segment (native DnD drop zone)**

```tsx
// components/console/Segment.tsx
"use client";
import type { SegmentId } from "@/lib/console/types";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import { widgetsInSegment } from "@/lib/console/reducers";
import WidgetFrame from "@/components/console/WidgetFrame";

export default function Segment({ id }: { id: SegmentId }) {
  const layout = useShellLayout();
  const widgets = widgetsInSegment(layout, id);
  const onDrop = (e: React.DragEvent) => {
    const wid = e.dataTransfer.getData("text/tn-widget");
    if (!wid) return;
    e.preventDefault();
    // index = position of the card the pointer is over, else append
    const cards = [...e.currentTarget.querySelectorAll("[data-widget-id]")] as HTMLElement[];
    let idx = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { idx = i; break; }
    }
    shellLayoutStore.move(wid, id, idx);
  };
  return (
    <div className="tn-seg" data-segment={id}
         onDragOver={(e) => { if (e.dataTransfer.types.includes("text/tn-widget")) e.preventDefault(); }}
         onDrop={onDrop}>
      {widgets.length === 0 && <p className="tn-seg-empty">Drop a widget here, or add one with ⌘K</p>}
      {widgets.map((w) => (
        <div key={w.id} data-widget-id={w.id} className="tn-seg-slot"><WidgetFrame instance={w} /></div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement ConsoleWorkspace (grips + resize + collapse)**

```tsx
// components/console/ConsoleWorkspace.tsx
"use client";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import type { SegmentId } from "@/lib/console/types";
import Segment from "@/components/console/Segment";
import StageHost from "@/components/console/StageHost";

function VGrip({ seg, dir }: { seg: SegmentId; dir: 1 | -1 }) {
  const layout = useShellLayout();
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startSize = layout.segments[seg].size;
    const move = (ev: PointerEvent) => shellLayoutStore.setSegment(seg, startSize + dir * (ev.clientX - startX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return <div className="tn-grip" onPointerDown={onDown} role="separator" aria-orientation="vertical" />;
}

export default function ConsoleWorkspace() {
  const layout = useShellLayout();
  const w = (s: SegmentId) => (layout.segments[s].collapsed ? 0 : layout.segments[s].size);
  return (
    <div className="tn-cw-shell">
      <div className="tn-cw-col" style={{ width: w("left") }}><Segment id="left" /></div>
      <VGrip seg="left" dir={1} />
      <div className="tn-cw-center">
        <div className="tn-cw-stage"><StageHost stage={layout.stage} /></div>
        <div className="tn-grip tn-grip-h"
             onPointerDown={(e) => {
               e.preventDefault();
               const startY = e.clientY, start = layout.segments.bottom.size;
               const move = (ev: PointerEvent) => shellLayoutStore.setSegment("bottom", start - (ev.clientY - startY));
               const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
               window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
             }} role="separator" aria-orientation="horizontal" />
        <div className="tn-cw-bottom" style={{ height: layout.segments.bottom.collapsed ? 0 : layout.segments.bottom.size }}>
          <Segment id="bottom" />
        </div>
      </div>
      <VGrip seg="right" dir={-1} />
      <div className="tn-cw-col" style={{ width: w("right") }}><Segment id="right" /></div>
    </div>
  );
}
```

- [ ] **Step 3: Styles** — append to `app/globals.css`:

```css
.tn-cw-shell{position:absolute;inset:0;display:flex;min-height:0}
.tn-cw-col{flex:none;overflow:hidden;display:flex}
.tn-cw-center{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.tn-cw-stage{flex:1;position:relative;min-height:0}
.tn-cw-bottom{flex:none;overflow:hidden;display:flex}
.tn-seg{flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:8px;padding:8px;background:#eef2f6}
.tn-seg-slot{flex:none}.tn-seg-empty{font-size:11px;color:#9aa6b2;text-align:center;margin:auto;padding:16px}
.tn-grip{width:6px;flex:none;cursor:col-resize;background:#cdd6e0}
.tn-grip:hover{background:#aebac6}.tn-grip-h{width:auto;height:6px;cursor:row-resize}
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`
Expected: clean (StageHost resolves after Task 8 — implement Task 8 before running e2e; tsc may flag the missing import until then, so commit Tasks 7-8 together if needed).

- [ ] **Step 5: Commit**

```bash
git add components/console/Segment.tsx components/console/ConsoleWorkspace.tsx app/globals.css
git commit -m "feat(console): segments + workspace shell (resize, collapse, scroll, drag-drop)"
```

---

### Task 8: StageHost + StageSwitch + WorldClock

**Files:**
- Create: `components/console/StageHost.tsx`, `components/console/StageSwitch.tsx`, `components/console/WorldClock.tsx`
- Modify: none yet (StageSwitch mounted in Task 15)

**Interfaces:**
- Consumes: `shellLayoutStore.stage`, `viewModeStore` (sets map projection: `explore`=globe/3D, `console`=mercator/2D).
- Produces: `StageHost({ stage }: { stage: StageId })` — renders `<WorldMap/>` (dynamic, ssr:false) for `map2d`/`map3d` and `<WorldClock/>` for `clock`, and syncs `viewModeStore` to the projection; `StageSwitch()` — the 3D/2D/🕐 buttons; `WorldClock()` — multi-timezone clock.

- [ ] **Step 1: Implement StageHost (reuse viewMode → projection)**

```tsx
// components/console/StageHost.tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { StageId } from "@/lib/console/types";
import { viewModeStore } from "@/lib/shell/viewMode";
import WorldClock from "@/components/console/WorldClock";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function StageHost({ stage }: { stage: StageId }) {
  // The map reads viewModeStore for its MapLibre projection: 3D=globe(explore), 2D=flat(console).
  useEffect(() => {
    if (stage === "map3d") viewModeStore.set("explore");
    else if (stage === "map2d") viewModeStore.set("console");
  }, [stage]);
  if (stage === "clock") return <WorldClock />;
  return <WorldMap />;
}
```

- [ ] **Step 2: Implement WorldClock**

```tsx
// components/console/WorldClock.tsx
"use client";
import { useEffect, useState } from "react";
const ZONES = [
  { zone: "Europe/London", label: "LONDON" },
  { zone: "America/New_York", label: "NEW YORK" },
  { zone: "Asia/Tokyo", label: "TOKYO" },
  { zone: "UTC", label: "UTC" },
];
export default function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="tn-clock">
      {ZONES.map((z) => (
        <div key={z.zone} className="tn-clock-cell">
          <div className="tn-clock-time">{now ? now.toLocaleTimeString("en-GB", { timeZone: z.zone, hour: "2-digit", minute: "2-digit" }) : "--:--"}</div>
          <div className="tn-clock-zone">{z.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement StageSwitch**

```tsx
// components/console/StageSwitch.tsx
"use client";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import type { StageId } from "@/lib/console/types";
const OPTS: { id: StageId; label: string }[] = [
  { id: "map3d", label: "3D" }, { id: "map2d", label: "2D" }, { id: "clock", label: "🕐" },
];
export default function StageSwitch() {
  const { stage } = useShellLayout();
  return (
    <div className="tn-stage-switch" role="group" aria-label="Centre stage">
      {OPTS.map((o) => (
        <button key={o.id} className={stage === o.id ? "is-on" : ""} aria-pressed={stage === o.id}
                onClick={() => shellLayoutStore.stage(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Styles** — append to `app/globals.css`:

```css
.tn-clock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:32px;background:radial-gradient(circle at 50% 40%,#26323d,#141c24)}
.tn-clock-time{font-size:34px;font-weight:800;color:#fff;letter-spacing:1px}.tn-clock-zone{font-size:11px;color:#9fb0bf;letter-spacing:1px;text-align:center}
.tn-stage-switch{display:inline-flex;gap:2px;background:#fff;border:1px solid #d7dee6;border-radius:7px;padding:2px}
.tn-stage-switch button{border:0;background:none;font-size:11px;font-weight:700;color:#5a6470;padding:2px 8px;border-radius:5px;cursor:pointer}
.tn-stage-switch button.is-on{background:#27313b;color:#fff}
```

- [ ] **Step 5: Verify compile + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/console/StageHost.tsx components/console/WorldClock.tsx components/console/StageSwitch.tsx app/globals.css
git commit -m "feat(console): stage host (map 3D/2D · world clock) + stage switch"
```

---

## Phase D — Widgets

### Task 9: Aviation widget + alert rules

**Files:**
- Create: `lib/console/widgets/aviation.rules.ts`, `lib/console/widgets/aviation.tsx`
- Test: `tests/unit/console-aviation.test.ts`

**Interfaces:**
- Consumes: `usePlanes` from `@/lib/planes/usePlanes` (the data feeding the planes map layer), `WidgetBodyProps`, `useWidgetReport`, `AlertRule`/`Alert`.
- Produces: `aviationAlerts: AlertRule<PlaneLite>` where `PlaneLite = { callsign:string; squawk?:string; isMilitary?:boolean }`; `AVIATION_WIDGET: WidgetType` (self-registers on import).

- [ ] **Step 1: Write the failing test (pure rules only)**

```ts
// tests/unit/console-aviation.test.ts
import { expect, test } from "vitest";
import { aviationAlerts, type PlaneLite } from "@/lib/console/widgets/aviation.rules";

const planes: PlaneLite[] = [
  { callsign: "AF23", squawk: "7700" },
  { callsign: "BA117", squawk: "2200" },
  { callsign: "RCH804", squawk: "1234", isMilitary: true },
  { callsign: "UA90", squawk: "7600" },
];

test("flags emergency squawks 7500/7600/7700 as critical", () => {
  const a = aviationAlerts(planes, {});
  const crit = a.filter((x) => x.severity === "critical").map((x) => x.ref);
  expect(crit.sort()).toEqual(["AF23", "UA90"]);
});

test("flags military entry as info", () => {
  const a = aviationAlerts(planes, {});
  expect(a.find((x) => x.ref === "RCH804")?.severity).toBe("info");
});

test("clean traffic produces no alerts", () => {
  expect(aviationAlerts([{ callsign: "X", squawk: "1000" }], {})).toEqual([]);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-aviation`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the rules**

```ts
// lib/console/widgets/aviation.rules.ts
import type { AlertRule, Alert } from "@/lib/console/alerts";
export interface PlaneLite { callsign: string; squawk?: string; isMilitary?: boolean }
const EMERGENCY = new Set(["7500", "7600", "7700"]);
const REASON: Record<string, string> = { "7500": "hijack", "7600": "radio failure", "7700": "emergency" };

export const aviationAlerts: AlertRule<PlaneLite> = (planes) => {
  const out: Alert[] = [];
  for (const p of planes) {
    if (p.squawk && EMERGENCY.has(p.squawk)) {
      out.push({ id: `sq-${p.callsign}`, severity: "critical", text: `${p.callsign} squawk ${p.squawk} — ${REASON[p.squawk]}`, ref: p.callsign });
    } else if (p.isMilitary) {
      out.push({ id: `mil-${p.callsign}`, severity: "info", text: `Military ${p.callsign} in region`, ref: p.callsign });
    }
  }
  return out;
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-aviation`
Expected: PASS.

- [ ] **Step 5: Implement the widget body + register (UI)**

```tsx
// lib/console/widgets/aviation.tsx
"use client";
import { useEffect, useMemo } from "react";
import { usePlanes } from "@/lib/planes/usePlanes";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { runAlertRule } from "@/lib/console/alerts";
import { aviationAlerts, type PlaneLite } from "@/lib/console/widgets/aviation.rules";

function AviationBody({ config }: WidgetBodyProps) {
  const planes = usePlanes(); // existing hook → array of live planes
  const lite: PlaneLite[] = useMemo(
    () => planes.map((p) => ({ callsign: p.callsign ?? p.hex ?? "?", squawk: p.squawk, isMilitary: p.isMilitary })),
    [planes],
  );
  const sortKey = (config.sort as string) ?? "alt";
  const rows = useMemo(() => {
    const r = [...planes];
    r.sort((a, b) => (sortKey === "alt" ? (b.altitude ?? 0) - (a.altitude ?? 0) : (a.callsign ?? "").localeCompare(b.callsign ?? "")));
    return r.slice(0, 200);
  }, [planes, sortKey]);
  const report = useWidgetReport();
  useEffect(() => {
    report({ alerts: runAlertRule(aviationAlerts, lite, config), count: planes.length, freshLabel: "live" });
  }, [lite, planes.length, report, config]);

  return (
    <table className="tn-w-table"><tbody>
      {rows.map((p) => (
        <tr key={p.id ?? p.hex}><td className="tn-w-strong">{p.callsign ?? p.hex}</td>
          <td>{p.origin ?? ""}{p.destination ? `→${p.destination}` : ""}</td>
          <td className="tn-w-num">{p.altitude != null ? `${Math.round(p.altitude / 1000)}k` : ""}</td></tr>
      ))}
    </tbody></table>
  );
}

export const AVIATION_WIDGET = {
  id: "aviation", title: "Aviation", icon: "✈", category: "Aviation",
  defaultHeight: 280, defaultConfig: { sort: "alt" }, component: AviationBody,
  capabilities: { filter: true, sort: true },
};
registerWidget(AVIATION_WIDGET);
```

> Note: `usePlanes()`'s element shape is the existing plane type. If a referenced field (`squawk`, `isMilitary`, `altitude`, `origin`) is named differently, adapt the `.map` in `AviationBody` only — the rules test fixes the rule contract.

- [ ] **Step 6: tsc + commit**

Run: `npx tsc --noEmit`

```bash
git add lib/console/widgets/aviation.rules.ts lib/console/widgets/aviation.tsx tests/unit/console-aviation.test.ts
git commit -m "feat(console): Aviation widget + emergency-squawk/military alert rules"
```

---

### Task 10: Disasters & Events widget + alert rules

**Files:**
- Create: `lib/console/widgets/events.rules.ts`, `lib/console/widgets/events.tsx`
- Test: `tests/unit/console-events.test.ts`

**Interfaces:**
- Consumes: `useEventFeeds` + `projectEventFeed` + `FeedInput`/`FeedSort` from `@/lib/widgets/eventFeed`/`useEventFeeds`; `SeverityTier`/`EventType` from `@/lib/events/model`; `useScope`.
- Produces: `eventAlerts: AlertRule<EventLite>` where `EventLite = { id:string; type:EventType; tier:SeverityTier; title:string; magnitude?:number }` — flags `tier ∈ {S3,S4}` (severity by tier) and quakes `magnitude>=5`; `EVENTS_WIDGET: WidgetType`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/console-events.test.ts
import { expect, test } from "vitest";
import { eventAlerts, type EventLite } from "@/lib/console/widgets/events.rules";

const evs: EventLite[] = [
  { id: "1", type: "quake", tier: "S2", title: "M4.7 quake", magnitude: 4.7 },
  { id: "2", type: "quake", tier: "S2", title: "M5.2 quake", magnitude: 5.2 },
  { id: "3", type: "disaster", tier: "S4", title: "Earthquake Venezuela" },
  { id: "4", type: "cyclone", tier: "S1", title: "Storm" },
];

test("flags S3/S4 tiers and M5+ quakes; ignores routine", () => {
  const ids = eventAlerts(evs, {}).map((a) => a.ref).sort();
  expect(ids).toEqual(["2", "3"]);
});

test("S4 is critical, S3 is warn", () => {
  const a = eventAlerts([{ id: "x", type: "disaster", tier: "S3", title: "Drought" }], {});
  expect(a[0].severity).toBe("warn");
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-events`
Expected: FAIL.

- [ ] **Step 3: Implement rules**

```ts
// lib/console/widgets/events.rules.ts
import type { AlertRule, Alert } from "@/lib/console/alerts";
import type { EventType, SeverityTier } from "@/lib/events/model";
export interface EventLite { id: string; type: EventType; tier: SeverityTier; title: string; magnitude?: number }

export const eventAlerts: AlertRule<EventLite> = (events) => {
  const out: Alert[] = [];
  for (const e of events) {
    const bigTier = e.tier === "S4" || e.tier === "S3";
    const bigQuake = e.type === "quake" && (e.magnitude ?? 0) >= 5;
    if (bigTier || bigQuake) {
      const severity = e.tier === "S4" ? "critical" : e.tier === "S3" ? "warn" : "warn";
      out.push({ id: `ev-${e.id}`, severity, text: e.title, ref: e.id });
    }
  }
  return out;
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-events`
Expected: PASS.

- [ ] **Step 5: Implement widget body + register**

```tsx
// lib/console/widgets/events.tsx
"use client";
import { useEffect, useMemo } from "react";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedInput } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { runAlertRule } from "@/lib/console/alerts";
import { eventAlerts, type EventLite } from "@/lib/console/widgets/events.rules";

function EventsBody({ config }: WidgetBodyProps) {
  const scope = useScope();
  const { bySource } = useEventFeeds();
  const input: FeedInput = { bySource, scope, minTier: (config.minTier as never) ?? "S1", sort: (config.sort as never) ?? "severity" };
  const rows = useMemo(() => projectEventFeed(input), [bySource, scope, config.minTier, config.sort]);
  const lite: EventLite[] = useMemo(
    () => rows.map((r) => ({ id: r.id, type: r.type, tier: r.tier, title: r.title, magnitude: r.magnitude })),
    [rows],
  );
  const report = useWidgetReport();
  useEffect(() => { report({ alerts: runAlertRule(eventAlerts, lite, config), count: rows.length, freshLabel: "2m" }); }, [lite, rows.length, report, config]);

  return (
    <ul className="tn-w-list">
      {rows.slice(0, 100).map((r) => (
        <li key={r.id}><span className={`tn-w-sev tn-${r.tier}`}>{r.tier}</span> <b>{r.type}</b> {r.title}</li>
      ))}
    </ul>
  );
}

export const EVENTS_WIDGET = {
  id: "events", title: "Disasters & Events", icon: "🌎", category: "Events",
  defaultHeight: 320, defaultConfig: { minTier: "S1", sort: "severity" }, component: EventsBody,
  capabilities: { filter: true, sort: true },
};
registerWidget(EVENTS_WIDGET);
```

> Note: align the `projectEventFeed` `FeedInput` field names and the row shape with `components/shell/EventFeed.tsx` (it already calls `useEventFeeds()` + `projectEventFeed`); copy its exact usage. Only the `EventLite` mapping needs to match `events.rules.ts`.

- [ ] **Step 6: tsc + commit**

Run: `npx tsc --noEmit`

```bash
git add lib/console/widgets/events.rules.ts lib/console/widgets/events.tsx tests/unit/console-events.test.ts
git commit -m "feat(console): Disasters & Events widget + S3+/M5+ alert rules"
```

---

### Task 11: Cameras widget + alert rules

**Files:**
- Create: `lib/console/widgets/cameras.rules.ts`, `lib/console/widgets/cameras.tsx`
- Test: `tests/unit/console-cameras.test.ts`

**Interfaces:**
- Consumes: `loadedCamerasStore` from `@/lib/cameras/loaded`; `CameraVideo` from `@/components/CameraVideo`; `cinematic` dive (optional, for click).
- Produces: `cameraAlerts: AlertRule<CameraLite>` where `CameraLite = { id:string; name:string; available:boolean }` — flags `available===false` as `warn`; `CAMERAS_WIDGET: WidgetType`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/console-cameras.test.ts
import { expect, test } from "vitest";
import { cameraAlerts, type CameraLite } from "@/lib/console/widgets/cameras.rules";

const cams: CameraLite[] = [
  { id: "a", name: "LHR A4", available: true },
  { id: "b", name: "I-95 MM12", available: false },
];

test("flags offline cameras as warn", () => {
  const a = cameraAlerts(cams, {});
  expect(a.length).toBe(1);
  expect(a[0].severity).toBe("warn");
  expect(a[0].ref).toBe("b");
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-cameras`
Expected: FAIL.

- [ ] **Step 3: Implement rules**

```ts
// lib/console/widgets/cameras.rules.ts
import type { AlertRule, Alert } from "@/lib/console/alerts";
export interface CameraLite { id: string; name: string; available: boolean }
export const cameraAlerts: AlertRule<CameraLite> = (cams) => {
  const out: Alert[] = [];
  for (const c of cams) if (!c.available) out.push({ id: `cam-${c.id}`, severity: "warn", text: `${c.name} went offline`, ref: c.id });
  return out;
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-cameras`
Expected: PASS.

- [ ] **Step 5: Implement widget body + register**

```tsx
// lib/console/widgets/cameras.tsx
"use client";
import { useEffect, useMemo } from "react";
import { loadedCamerasStore } from "@/lib/cameras/loaded";
import { useSyncExternalStore } from "react";
import { CameraVideo } from "@/components/CameraVideo";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { runAlertRule } from "@/lib/console/alerts";
import { cameraAlerts, type CameraLite } from "@/lib/console/widgets/cameras.rules";

function CamerasBody({ config }: WidgetBodyProps) {
  const cams = useSyncExternalStore(loadedCamerasStore.subscribe, loadedCamerasStore.get, loadedCamerasStore.get);
  const lite: CameraLite[] = useMemo(() => cams.map((c) => ({ id: c.id, name: c.name, available: c.available !== false })), [cams]);
  const report = useWidgetReport();
  useEffect(() => { report({ alerts: runAlertRule(cameraAlerts, lite, config), count: cams.length, freshLabel: "live" }); }, [lite, cams.length, report, config]);
  return (
    <div className="tn-cam-grid">
      {cams.slice(0, 6).map((c) => (
        <div key={c.id} className="tn-cam-cell">
          <CameraVideo id={c.id} alt={c.name} attribution={c.attribution ?? ""} license={c.license ?? ""} refreshSeconds={c.refreshSeconds ?? 30} />
          <span className="tn-cam-label">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

export const CAMERAS_WIDGET = {
  id: "cameras", title: "Cameras", icon: "📷", category: "Cameras",
  defaultHeight: 260, defaultConfig: {}, component: CamerasBody,
};
registerWidget(CAMERAS_WIDGET);
```

> Note: match the loaded-camera element shape from `lib/cameras/loaded` (fields `id/name/available/attribution/license/refreshSeconds`); adapt the `.map` only.

- [ ] **Step 6: tsc + commit**

Run: `npx tsc --noEmit`

```bash
git add lib/console/widgets/cameras.rules.ts lib/console/widgets/cameras.tsx tests/unit/console-cameras.test.ts
git commit -m "feat(console): Cameras widget + offline alert rule"
```

---

### Task 12: Live Video News — provider catalogue + widget

**Files:**
- Create: `lib/console/news/providers.ts`, `lib/console/widgets/news.tsx`
- Test: `tests/unit/console-news-providers.test.ts`

**Interfaces:**
- Produces: `NewsProvider { id:string; name:string; category:string; kind:"youtube"|"hls"; ref:string; favorite?:boolean }`; `NEWS_PROVIDERS: NewsProvider[]` (~12 seeded); `parseCustomStream(url:string): NewsProvider|null` (accepts a YouTube watch/live URL → `kind:"youtube"`, or a `.m3u8` URL → `kind:"hls"`); `resolveEmbed(p): { kind:"youtube"|"hls"; src:string }`; `NEWS_WIDGET: WidgetType`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/console-news-providers.test.ts
import { expect, test } from "vitest";
import { NEWS_PROVIDERS, parseCustomStream, resolveEmbed } from "@/lib/console/news/providers";

test("seeds at least 10 free providers with valid kinds", () => {
  expect(NEWS_PROVIDERS.length).toBeGreaterThanOrEqual(10);
  for (const p of NEWS_PROVIDERS) expect(["youtube", "hls"]).toContain(p.kind);
});

test("parseCustomStream reads a YouTube live URL", () => {
  const p = parseCustomStream("https://www.youtube.com/watch?v=abc123XYZ");
  expect(p?.kind).toBe("youtube");
  expect(p?.ref).toBe("abc123XYZ");
});

test("parseCustomStream reads an HLS url and rejects junk", () => {
  expect(parseCustomStream("https://x.com/live/stream.m3u8")?.kind).toBe("hls");
  expect(parseCustomStream("not a url")).toBeNull();
});

test("resolveEmbed builds a youtube embed src", () => {
  const e = resolveEmbed({ id: "x", name: "X", category: "World", kind: "youtube", ref: "abc123XYZ" });
  expect(e.kind).toBe("youtube");
  expect(e.src).toContain("youtube.com/embed/abc123XYZ");
  expect(e.src).toContain("autoplay=1");
  expect(e.src).toContain("mute=1");
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-news-providers`
Expected: FAIL.

- [ ] **Step 3: Implement providers**

```ts
// lib/console/news/providers.ts
export interface NewsProvider { id: string; name: string; category: string; kind: "youtube" | "hls"; ref: string; favorite?: boolean }

// YouTube live video ids for free 24/7 news channels. ids are tunable — they
// occasionally rotate; the picker's add-custom-stream covers breakage.
export const NEWS_PROVIDERS: NewsProvider[] = [
  { id: "aljazeera", name: "Al Jazeera English", category: "World", kind: "youtube", ref: "gCNeDWCI0vo", favorite: true },
  { id: "dw", name: "DW News", category: "World", kind: "youtube", ref: "tQwQfNuvb1A", favorite: true },
  { id: "france24", name: "France 24", category: "World", kind: "youtube", ref: "h3MuIUNCCzI", favorite: true },
  { id: "sky", name: "Sky News", category: "World", kind: "youtube", ref: "9Auq9mYxFEE" },
  { id: "euronews", name: "Euronews", category: "World", kind: "youtube", ref: "pykpO5kQJ98" },
  { id: "cna", name: "CNA", category: "World", kind: "youtube", ref: "XWq5kBlakcQ" },
  { id: "trt", name: "TRT World", category: "World", kind: "youtube", ref: "Wp0_Dk0nJOk" },
  { id: "nhk", name: "NHK World", category: "World", kind: "youtube", ref: "f0lYkdg2DZw" },
  { id: "abcau", name: "ABC News (AU)", category: "World", kind: "youtube", ref: "vOTiJkg1voo" },
  { id: "bloomberg", name: "Bloomberg TV", category: "Business", kind: "youtube", ref: "iEpJwprxDdk" },
  { id: "nasa", name: "NASA TV", category: "Space", kind: "youtube", ref: "21X5lGlDOfg" },
  { id: "iss", name: "ISS Live", category: "Space", kind: "youtube", ref: "DIgkvm2nmHc" },
];

const YT_ID = /(?:v=|youtu\.be\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{6,})/;

export function parseCustomStream(url: string): NewsProvider | null {
  const u = url.trim();
  const yt = u.match(YT_ID);
  if (yt) return { id: `custom-${yt[1]}`, name: "Custom (YouTube)", category: "Custom", kind: "youtube", ref: yt[1] };
  if (/^https?:\/\/\S+\.m3u8(\?\S*)?$/i.test(u)) return { id: `custom-hls`, name: "Custom (HLS)", category: "Custom", kind: "hls", ref: u };
  return null;
}

export function resolveEmbed(p: NewsProvider): { kind: "youtube" | "hls"; src: string } {
  if (p.kind === "youtube") return { kind: "youtube", src: `https://www.youtube.com/embed/${p.ref}?autoplay=1&mute=1&playsinline=1` };
  return { kind: "hls", src: p.ref };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- console-news-providers`
Expected: PASS.

- [ ] **Step 5: Implement the widget (YouTube iframe / HLS video) + register**

```tsx
// lib/console/widgets/news.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { NEWS_PROVIDERS, parseCustomStream, resolveEmbed, type NewsProvider } from "@/lib/console/news/providers";

function NewsBody({ instanceId, config }: WidgetBodyProps) {
  const report = useWidgetReport();
  const activeId = (config.providerId as string) ?? NEWS_PROVIDERS[0].id;
  const custom = config.customProvider as NewsProvider | undefined;
  const active = custom?.id === activeId ? custom : NEWS_PROVIDERS.find((p) => p.id === activeId) ?? NEWS_PROVIDERS[0];
  const embed = resolveEmbed(active);
  const favorites = NEWS_PROVIDERS.filter((p) => p.favorite).slice(0, 4);
  const [picker, setPicker] = useState(false);
  useEffect(() => { report({ alerts: [], freshLabel: "live" }); }, [report]);

  const choose = (id: string) => { import("@/lib/console/store").then((m) => m.shellLayoutStore.configure(instanceId, { providerId: id })); };
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (embed.kind !== "hls" || !videoRef.current) return;
    const v = videoRef.current; let hls: { destroy(): void } | null = null; let cancelled = false;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = embed.src; return; }
    (async () => { const Hls = (await import("hls.js")).default; if (cancelled || !Hls.isSupported()) return; const h = new Hls(); hls = h; h.loadSource(embed.src); h.attachMedia(v); })();
    return () => { cancelled = true; hls?.destroy(); };
  }, [embed.kind, embed.src]);

  return (
    <div className="tn-news">
      <div className="tn-news-screen">
        {embed.kind === "youtube"
          ? <iframe className="tn-news-video" src={embed.src} title={active.name} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          : <video ref={videoRef} className="tn-news-video" muted autoPlay playsInline controls />}
        <span className="tn-news-ch">{active.name}</span>
      </div>
      <div className="tn-news-tabs">
        {favorites.map((p) => (
          <button key={p.id} className={p.id === activeId ? "is-on" : ""} onClick={() => choose(p.id)}>{p.name.split(" ")[0]}</button>
        ))}
        <button className="tn-news-more" onClick={() => setPicker((o) => !o)}>＋ More…</button>
      </div>
      {picker && (
        <div className="tn-news-picker">
          {NEWS_PROVIDERS.map((p) => (
            <button key={p.id} onClick={() => { choose(p.id); setPicker(false); }}>{p.id === activeId ? "✓ " : ""}{p.name} <span className="tn-news-cat">{p.category}</span></button>
          ))}
          <input className="tn-news-custom" placeholder="Add stream URL (YouTube / .m3u8)…"
                 onKeyDown={(e) => {
                   if (e.key !== "Enter") return;
                   const p = parseCustomStream((e.target as HTMLInputElement).value);
                   if (p) import("@/lib/console/store").then((m) => m.shellLayoutStore.configure(instanceId, { providerId: p.id, customProvider: p }));
                 }} />
        </div>
      )}
    </div>
  );
}

export const NEWS_WIDGET = {
  id: "news", title: "Live News", icon: "📺", category: "News",
  defaultHeight: 240, defaultConfig: { providerId: "aljazeera" }, component: NewsBody,
};
registerWidget(NEWS_WIDGET);
```

- [ ] **Step 6: Styles** — append to `app/globals.css`:

```css
.tn-news{display:flex;flex-direction:column;height:100%}
.tn-news-screen{position:relative;aspect-ratio:16/9;background:#15212b}
.tn-news-video{position:absolute;inset:0;width:100%;height:100%;border:0}
.tn-news-ch{position:absolute;left:6px;bottom:6px;color:#fff;font-size:10px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.tn-news-tabs{display:flex;gap:4px;padding:6px;flex-wrap:wrap}
.tn-news-tabs button{font-size:9px;border:1px solid #e1e8ef;border-radius:10px;padding:2px 7px;background:#fff;cursor:pointer}
.tn-news-tabs button.is-on{background:#27313b;color:#fff;border-color:#27313b}.tn-news-more{color:#3f8f5c;border-style:dashed!important}
.tn-news-picker{display:flex;flex-direction:column;border-top:1px solid #eef2f6;max-height:160px;overflow:auto}
.tn-news-picker button{text-align:left;border:0;background:none;padding:5px 9px;font-size:11px;cursor:pointer}
.tn-news-cat{color:#9aa6b2;font-size:9px;float:right}.tn-news-custom{margin:6px 9px;padding:4px;font-size:11px;border:1px solid #e1e8ef;border-radius:5px}
```

- [ ] **Step 7: tsc + commit**

Run: `npx tsc --noEmit`

```bash
git add lib/console/news/providers.ts lib/console/widgets/news.tsx tests/unit/console-news-providers.test.ts app/globals.css
git commit -m "feat(console): Live Video News widget + provider catalogue (favourites/picker/custom)"
```

---

## Phase E — Catalog, presets, share, mount

### Task 13: Widget index + ⌘K catalog upgrade

**Files:**
- Create: `lib/console/widgets/index.ts`
- Modify: `components/shell/CommandPalette.tsx`

**Interfaces:**
- Consumes: `widgetsByCategory`/`listWidgetTypes` (registry), `shellLayoutStore`, `STAGES`.
- Produces: side-effect import that registers all four widgets; new palette commands `Add <widget>` (per type), `Stage → 3D/2D/Clock`.

- [ ] **Step 1: Create the registration barrel**

```ts
// lib/console/widgets/index.ts
// Importing this file registers every console widget exactly once.
import "@/lib/console/widgets/aviation";
import "@/lib/console/widgets/events";
import "@/lib/console/widgets/cameras";
import "@/lib/console/widgets/news";
```

- [ ] **Step 2: Add catalog commands to the palette**

In `components/shell/CommandPalette.tsx`, inside `buildCommands(close)`, after the existing layer/preset loops, append:

```ts
import "@/lib/console/widgets"; // ensure registry populated
import { widgetsByCategory } from "@/lib/console/registry";
import { shellLayoutStore } from "@/lib/console/store";
import type { StageId } from "@/lib/console/types";

// …inside buildCommands(), append:
for (const group of widgetsByCategory()) {
  for (const t of group.types) {
    const openCount = shellLayoutStore.get().widgets.filter((w) => w.type === t.id).length;
    cmds.push({
      id: `add-${t.id}`,
      label: `Add ${t.title}${openCount ? ` (${openCount} open)` : ""}`,
      hint: group.category.toLowerCase(),
      run: () => { const r = shellLayoutStore.add(t.id, { config: { ...t.defaultConfig }, height: t.defaultHeight }); if (!r.ok) alertCapacity(); close(); },
    });
  }
}
const STAGES: { id: StageId; label: string }[] = [{ id: "map3d", label: "3D map" }, { id: "map2d", label: "2D map" }, { id: "clock", label: "World clock" }];
for (const s of STAGES) cmds.push({ id: `stage-${s.id}`, label: `Stage → ${s.label}`, hint: "stage", run: () => { shellLayoutStore.stage(s.id); close(); } });
```

Add a tiny capacity helper at module scope (above `buildCommands`):

```ts
function alertCapacity() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tn-toast", { detail: "50-widget limit — remove one to add another" }));
}
```

- [ ] **Step 3: Verify compile + manual run**

Run: `npx tsc --noEmit` (clean), then `npm run dev`, press ⌘K, type "Add" → the four widgets appear with open-counts; "Stage" → three stage commands.

- [ ] **Step 4: Commit**

```bash
git add lib/console/widgets/index.ts components/shell/CommandPalette.tsx
git commit -m "feat(console): ⌘K widget catalog (add instances + open counts) + stage commands"
```

---

### Task 14: Presets + URL share

**Files:**
- Create: `lib/console/presets.ts`, `lib/console/share.ts`
- Test: `tests/unit/console-presets.test.ts`, `tests/unit/console-share.test.ts`

**Interfaces:**
- Consumes: `ShellLayout`, reducers’ `addWidget`, `createDefaultLayout`, `loadPersisted`/`savePersisted`.
- Produces: `ConsolePreset { id:string; title:string; icon:string; build(): ShellLayout }`; `BUILTIN_PRESETS: ConsolePreset[]` (World, Aviation Ops, Disaster Response); `applyPreset(id): void` (replaces the store layout); `saveCustomPreset(title): void`; `listPresets(): {id;title;icon}[]`. `encodeLayout(l): string` / `decodeLayout(s): ShellLayout|null` (compact, URL-safe).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/console-presets.test.ts
import { expect, test } from "vitest";
import { BUILTIN_PRESETS } from "@/lib/console/presets";

test("built-ins are non-empty and within the cap", () => {
  const ids = BUILTIN_PRESETS.map((p) => p.id);
  expect(ids).toContain("world");
  expect(ids).toContain("aviation-ops");
  expect(ids).toContain("disaster-response");
  for (const p of BUILTIN_PRESETS) {
    const l = p.build();
    expect(l.widgets.length).toBeGreaterThan(0);
    expect(l.widgets.length).toBeLessThanOrEqual(50);
  }
});

test("aviation-ops puts an aviation widget on the canvas with a stage", () => {
  const l = BUILTIN_PRESETS.find((p) => p.id === "aviation-ops")!.build();
  expect(l.widgets.some((w) => w.type === "aviation")).toBe(true);
  expect(["map2d", "map3d", "clock"]).toContain(l.stage);
});
```

```ts
// tests/unit/console-share.test.ts
import { expect, test } from "vitest";
import { encodeLayout, decodeLayout } from "@/lib/console/share";
import { BUILTIN_PRESETS } from "@/lib/console/presets";

test("encode→decode round-trips a layout", () => {
  const l = BUILTIN_PRESETS.find((p) => p.id === "disaster-response")!.build();
  const round = decodeLayout(encodeLayout(l));
  expect(round?.stage).toBe(l.stage);
  expect(round?.widgets.map((w) => w.type)).toEqual(l.widgets.map((w) => w.type));
});

test("decode returns null on garbage", () => {
  expect(decodeLayout("@@@notjson@@@")).toBeNull();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- console-presets console-share`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement presets**

```ts
// lib/console/presets.ts
"use client";
import { createDefaultLayout, type ShellLayout, type SegmentId } from "@/lib/console/types";
import { addWidget, setStage } from "@/lib/console/reducers";
import { shellLayoutStore } from "@/lib/console/store";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export interface ConsolePreset { id: string; title: string; icon: string; build(): ShellLayout }

let seed = 0;
const id = () => `p${(seed += 1).toString(36)}`;
function compose(stage: ShellLayout["stage"], specs: { type: string; segment: SegmentId }[]): ShellLayout {
  let l = setStage(createDefaultLayout(), stage);
  for (const s of specs) l = addWidget(l, s.type, id(), { segment: s.segment });
  return l;
}

export const BUILTIN_PRESETS: ConsolePreset[] = [
  { id: "world", title: "World", icon: "🌐", build: () => compose("map2d", [
      { type: "events", segment: "left" }, { type: "news", segment: "bottom" },
      { type: "cameras", segment: "right" }, { type: "aviation", segment: "left" },
  ]) },
  { id: "aviation-ops", title: "Aviation Ops", icon: "✈", build: () => compose("map2d", [
      { type: "aviation", segment: "left" }, { type: "events", segment: "left" },
      { type: "cameras", segment: "right" }, { type: "news", segment: "bottom" },
  ]) },
  { id: "disaster-response", title: "Disaster Response", icon: "🆘", build: () => compose("map2d", [
      { type: "events", segment: "left" }, { type: "cameras", segment: "right" },
      { type: "news", segment: "bottom" },
  ]) },
];

const KEY = "tn.console.presets.v1";
const VERSION = 1;
interface CustomPreset { id: string; title: string; layout: ShellLayout }

function loadCustom(): CustomPreset[] { return loadPersisted<CustomPreset[]>(KEY, VERSION) ?? []; }

export function applyPreset(presetId: string): void {
  const built = BUILTIN_PRESETS.find((p) => p.id === presetId);
  if (built) { shellLayoutStore.replace(built.build()); return; }
  const custom = loadCustom().find((p) => p.id === presetId);
  if (custom) shellLayoutStore.replace(custom.layout);
}

export function saveCustomPreset(title: string): void {
  const list = loadCustom();
  list.push({ id: `custom-${Date.now().toString(36)}`, title, layout: shellLayoutStore.get() });
  savePersisted(KEY, VERSION, list);
}

export function listPresets(): { id: string; title: string; icon: string }[] {
  return [...BUILTIN_PRESETS.map((p) => ({ id: p.id, title: p.title, icon: p.icon })),
          ...loadCustom().map((p) => ({ id: p.id, title: p.title, icon: "★" }))];
}
```

- [ ] **Step 4: Implement share**

```ts
// lib/console/share.ts
import type { ShellLayout } from "@/lib/console/types";

/** Compact, URL-safe encoding of a layout (base64 of JSON). */
export function encodeLayout(l: ShellLayout): string {
  const json = JSON.stringify(l);
  const b64 = typeof window === "undefined" ? Buffer.from(json, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeLayout(s: string): ShellLayout | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof window === "undefined" ? Buffer.from(b64, "base64").toString("utf8") : decodeURIComponent(escape(atob(b64)));
    const l = JSON.parse(json) as ShellLayout;
    if (!l || typeof l !== "object" || !Array.isArray(l.widgets) || !l.segments || !l.stage) return null;
    return l;
  } catch { return null; }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- console-presets console-share`
Expected: PASS.

- [ ] **Step 6: Wire presets + share into the palette (extend Task 13)**

In `components/shell/CommandPalette.tsx`, append after the stage commands:

```ts
import { listPresets, applyPreset, saveCustomPreset } from "@/lib/console/presets";
import { encodeLayout } from "@/lib/console/share";
import { shellLayoutStore } from "@/lib/console/store";

for (const p of listPresets()) cmds.push({ id: `cpreset-${p.id}`, label: `Preset: ${p.title}`, hint: "preset", run: () => { applyPreset(p.id); close(); } });
cmds.push({ id: "save-preset", label: "Save layout as preset…", hint: "preset", run: () => { const t = window.prompt("Preset name?"); if (t) saveCustomPreset(t); close(); } });
cmds.push({ id: "share-layout", label: "Copy shareable link", hint: "share", run: () => { const url = `${location.origin}${location.pathname}?c=${encodeLayout(shellLayoutStore.get())}`; navigator.clipboard?.writeText(url); close(); } });
```

- [ ] **Step 7: tsc + commit**

Run: `npx tsc --noEmit`

```bash
git add lib/console/presets.ts lib/console/share.ts components/shell/CommandPalette.tsx tests/unit/console-presets.test.ts tests/unit/console-share.test.ts
git commit -m "feat(console): presets (built-ins + save-your-own) + URL share"
```

---

### Task 15: Mount the console + reconcile chrome + e2e

**Files:**
- Modify: `components/shell/ConsoleShell.tsx`, `app/page.tsx`
- Create: `tests/e2e/console.spec.ts`

**Interfaces:**
- Consumes: `ConsoleWorkspace`, `StageSwitch`, `shellLayoutStore.hydrate`, `applyPreset`, `decodeLayout`, the widget registry barrel.

- [ ] **Step 1: Mount the workspace in ConsoleShell**

In `components/shell/ConsoleShell.tsx`:
1. Add imports: `import ConsoleWorkspace from "@/components/console/ConsoleWorkspace";`, `import StageSwitch from "@/components/console/StageSwitch";`, `import { shellLayoutStore } from "@/lib/console/store";`, `import { applyPreset } from "@/lib/console/presets";`, `import { decodeLayout } from "@/lib/console/share";`, `import "@/lib/console/widgets";`.
2. In the hydrate `useEffect`, after `viewModeStore.hydrate();` add:

```ts
shellLayoutStore.hydrate();
const c = new URLSearchParams(window.location.search).get("c");
if (c) { const l = decodeLayout(c); if (l) shellLayoutStore.replace(l); }
else if (shellLayoutStore.get().widgets.length === 0) applyPreset("world"); // first-run seed
```

3. Replace the `isConsole ? (…) : (…)` body block with the single workspace, keeping the chrome and overlays:

```tsx
return (
  <div className="tn-shell">
    <StatusBar onOpenPalette={() => setPaletteOpen(true)} />
    <BreakingBanner />
    <ConsoleWorkspace />
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    <FeedOverlay />
    <CinematicDive />
  </div>
);
```

(Remove the now-unused `children`, `view`, `isConsole`, `ws`, PanelHost/EventFeed/ConsoleTopBar/DockableWorkspace/IntelColumn/PlaceSearch/Coverage/Markets/Watchlist imports. Mount `<StageSwitch/>` inside `StatusBar` or as a top-bar element — add it to `StatusBar`'s right cluster.)

- [ ] **Step 2: Simplify page.tsx**

```tsx
// app/page.tsx
import ConsoleShell from "@/components/shell/ConsoleShell";
export default function Home() {
  return <main className="tn-shell-main"><ConsoleShell /></main>;
}
```

(`ConsoleShell` no longer takes children; the map now lives in `StageHost`.)

- [ ] **Step 3: Add StageSwitch to the top bar**

In `components/shell/StatusBar.tsx`, import and render `<StageSwitch/>` in the bar's control cluster.

- [ ] **Step 4: Write the e2e spec**

```ts
// tests/e2e/console.spec.ts
import { test, expect } from "@playwright/test";

test("first-run seeds the World preset with widgets in segments", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tn-cw").first()).toBeVisible();
  await expect(page.locator('[data-segment="left"] .tn-cw')).not.toHaveCount(0);
});

test("⌘K adds a widget instance", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator(".tn-cw").count();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search/).fill("Add Aviation");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tn-cw")).toHaveCount(before + 1);
});

test("stage switch swaps to the world clock", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tn-stage-switch button", { hasText: "🕐" }).click();
  await expect(page.locator(".tn-clock")).toBeVisible();
});

test("collapsing the left segment hides its widgets", async ({ page }) => {
  await page.goto("/");
  // drag the left grip fully left
  const grip = page.locator(".tn-grip").first();
  const box = await grip.boundingBox();
  if (box) { await page.mouse.move(box.x + 2, box.y + 20); await page.mouse.down(); await page.mouse.move(0, box.y + 20); await page.mouse.up(); }
  await expect(page.locator('[data-segment="left"]')).toHaveCSS("width", /0px|(\d|10|20)px/);
});
```

- [ ] **Step 5: Run everything**

Run: `npx tsc --noEmit` → clean.
Run: `npm test` → all `console-*` unit suites green.
Run: `npm run build` → succeeds.
Run: `npm run e2e -- console` → the four console e2e tests pass (start `npm run dev` if the Playwright config doesn't auto-start a server).

- [ ] **Step 6: Manual smoke**

`npm run dev` → load `/`: three segments with widgets, map on stage; ⌘K add/remove; drag a widget between segments; resize a segment to zero; switch to 3D/clock; apply "Aviation Ops" preset; copy shareable link, open in a new tab → same layout.

- [ ] **Step 7: Commit**

```bash
git add components/shell/ConsoleShell.tsx app/page.tsx components/shell/StatusBar.tsx tests/e2e/console.spec.ts
git commit -m "feat(console): mount widget console shell; reconcile chrome; e2e"
```

---

## Self-Review

**Spec coverage:**
- Shell: 3 segments + fixed stage, resize/collapse/scroll → Tasks 1-3, 7, 8 ✓
- Center stage 3D/2D/clock → Task 8 (reuses `viewModeStore` projection) ✓
- Widgets: multi-instance + 50 cap → Tasks 1-3 (cap), 6 (frame, duplicate/remove) ✓
- Curated alerts + strip + badge + A/B style → Tasks 5, 6, 9-11 ✓
- ⌘K catalog (add + counts) → Task 13 ✓
- Presets replace + built-ins + save-your-own + URL share → Task 14 ✓
- First-slice widgets (News video w/ provider picker, Aviation, Cameras, Events) → Tasks 9-12 ✓
- Reconcile chrome (keep CinematicDive/FeedOverlay; drop viewMode split) → Task 15 ✓
- Persistence (`tn.console.v1`) → Task 3 ✓

**Deferred (per spec §10), intentionally absent:** more widgets, configurable/correlated alerts, notify-when-away, mobile. ✓

**Placeholder scan:** No TBD/TODO; the three "Note" callouts point to a real sibling file to copy exact field names (allowed — they name the file and the exact adaptation point), not vague guidance.

**Type consistency:** `WidgetInstance`/`ShellLayout` fields used identically across reducers, store, frame, segment, presets, share. `AlertRule<T>`/`Alert` consistent across alerts + all `*.rules.ts`. `shellLayoutStore` method names (`add/remove/move/resizeWidget/configure/setSegment/collapseSegment/stage/replace/hydrate`) consistent across store, frame, palette, presets, shell. `resolveEmbed`/`parseCustomStream`/`NEWS_PROVIDERS` consistent across providers + news widget + tests.

**Known integration risks (flagged for the implementer, not blockers):**
- `usePlanes`/`loadedCamerasStore`/`projectEventFeed` element shapes: adapt the `.map` in the widget body to the real field names; the pure rules tests pin the rule contracts regardless.
- YouTube live video ids rotate; `add-custom-stream` is the escape hatch, and the ids are one-line edits.
- Playwright base URL / dev-server auto-start: confirm `playwright.config.ts` `webServer` is set; if not, run `npm run dev` alongside `npm run e2e`.
