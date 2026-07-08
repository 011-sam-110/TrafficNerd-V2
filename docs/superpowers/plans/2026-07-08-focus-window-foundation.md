# Focus Window — Foundation (F1 + F2 + W1 Events) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the focus-window feature end-to-end — any docked widget can expand onto the center stage — by shipping the focus foundation (F1), the shared primitives it needs (F2: buckets, `<Chart>`, `<InsetMap>`), and the first bespoke detail view (W1: Events).

**Architecture:** Focus is a single `focusedWidgetId` field on the persisted `ShellLayout`; when set, `StageHost` renders `<WidgetDetail>` instead of the globe (the `stage` field is untouched, so "back" restores the previous stage for free). A widget declares depth by adding an optional `detail` component to its `WidgetType`; the detail reuses the widget's existing data hook. Two shared, dependency-free primitives (`<Chart>` SVG, `<InsetMap>` single-layer MapLibre) and pure helpers (`buckets`, `chart/scale`, `map/inset`) back the detail views.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, MapLibre GL v5 (already a dep), vitest. **No new dependencies.**

## Global Constraints

- **Build gate (run for every task):** `npx tsc --noEmit && npm test`
- **Keyless-first / dormant-safe:** no feature in this plan needs an API key; data hooks already degrade to empty on failure — render honest empty states, never throw or 5xx.
- **Zero new dependencies:** charts and helpers are hand-rolled SVG/TS (repo convention — `Sparkline` and the RSS parser were both hand-rolled).
- **Commit style:** one commit per task, `<type>: <summary>` (e.g. `feat:`, `test:`), **solo attribution — NO Claude co-author trailer** (repo convention).
- **Styling:** use existing `tn-*` CSS tokens/classes in `app/globals.css` (`--tn-text-*`, `--tn-surface-2`, `--tn-accent`, etc.).
- **Purity:** pure logic (reducers, helpers) lives in testable `.ts` modules with vitest tests written first; React + MapLibre shells are verified with a Playwright screenshot.
- **Honesty:** never fabricate a value. Cyclone/GDACS events show native alert-level / wind / pressure, not a fake unified magnitude; empty feeds show an explicit empty state.

---

## File Structure

**Foundation (F1):**
- Modify `lib/console/types.ts` — add `focusedWidgetId` to `ShellLayout`.
- Modify `lib/console/reducers.ts` — `setFocus`; clear focus in `removeWidget`.
- Modify `lib/console/store.ts` — `focus()` / `unfocus()` actions.
- Modify `lib/console/sanitize.ts` — validate/round-trip `focusedWidgetId`.
- Modify `lib/console/registry.ts` — `WidgetDetailProps` + `WidgetType.detail?`.
- Create `components/console/WidgetDetail.tsx` — resolves the focused widget → its detail (or a generic fallback).
- Modify `components/console/StageHost.tsx` — focus branch.
- Modify `components/console/StageSwitch.tsx` — FOCUS chip; exit-focus on stage pick.
- Modify `components/console/WidgetFrame.tsx` — expand button.
- Modify `app/globals.css` — detail-surface styles.

**Primitives (F2):**
- Create `lib/widgets/buckets.ts` + `tests/unit/buckets.test.ts`.
- Create `lib/chart/scale.ts` + `tests/unit/chart-scale.test.ts`.
- Create `components/Chart.tsx`.
- Create `lib/map/inset.ts` + `tests/unit/map-inset.test.ts`.
- Create `components/InsetMap.tsx`.

**Events detail (W1):**
- Create `lib/widgets/eventMetrics.ts` + `tests/unit/event-metrics.test.ts`.
- Create `lib/console/widgets/events.detail.tsx`.
- Modify `lib/console/widgets/events.tsx` — attach `detail`.

---

## Task 1: Focus state (types + reducer + store)

**Files:**
- Modify: `lib/console/types.ts`
- Modify: `lib/console/reducers.ts`
- Modify: `lib/console/store.ts`
- Test: `tests/unit/focus-reducer.test.ts`

**Interfaces:**
- Consumes: `ShellLayout`, `createDefaultLayout`, `removeWidget` (existing).
- Produces:
  - `ShellLayout.focusedWidgetId: string | null`
  - `setFocus(l: ShellLayout, id: string | null): ShellLayout` (in `reducers.ts`)
  - `shellLayoutStore.focus(id: string): void` and `shellLayoutStore.unfocus(): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/focus-reducer.test.ts
import { describe, it, expect } from "vitest";
import { createDefaultLayout } from "@/lib/console/types";
import { setFocus, addWidget, removeWidget } from "@/lib/console/reducers";

describe("focus reducer", () => {
  it("defaults to no focused widget", () => {
    expect(createDefaultLayout().focusedWidgetId).toBeNull();
  });

  it("setFocus sets and clears the focused id", () => {
    const l0 = createDefaultLayout();
    const l1 = setFocus(l0, "wabc");
    expect(l1.focusedWidgetId).toBe("wabc");
    expect(setFocus(l1, null).focusedWidgetId).toBeNull();
  });

  it("removing the focused widget clears focus", () => {
    let l = addWidget(createDefaultLayout(), "events", "w1");
    l = setFocus(l, "w1");
    l = removeWidget(l, "w1");
    expect(l.focusedWidgetId).toBeNull();
  });

  it("removing a different widget leaves focus intact", () => {
    let l = addWidget(createDefaultLayout(), "events", "w1");
    l = addWidget(l, "markets", "w2");
    l = setFocus(l, "w1");
    l = removeWidget(l, "w2");
    expect(l.focusedWidgetId).toBe("w1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/focus-reducer.test.ts`
Expected: FAIL — `focusedWidgetId` missing / `setFocus is not a function`.

- [ ] **Step 3: Add the field to the type**

In `lib/console/types.ts`, add the field to `ShellLayout` and default it:

```ts
export interface ShellLayout {
  segments: Record<SegmentId, SegmentState>;
  stage: StageId;
  widgets: WidgetInstance[];
  /** The widget expanded onto the center stage, or null when the map is shown. */
  focusedWidgetId: string | null;
}
```

```ts
export function createDefaultLayout(): ShellLayout {
  return {
    segments: {
      left: { size: 320, collapsed: false },
      right: { size: 320, collapsed: false },
      bottom: { size: 240, collapsed: false },
    },
    stage: "map2d",
    widgets: [],
    focusedWidgetId: null,
  };
}
```

- [ ] **Step 4: Add the reducer + clear-on-remove**

In `lib/console/reducers.ts`, add `setFocus` at the end and update `removeWidget` to clear a dangling focus:

```ts
export function setFocus(l: ShellLayout, id: string | null): ShellLayout {
  return { ...l, focusedWidgetId: id };
}
```

In `removeWidget`, change the final return so a removed focused widget clears focus:

```ts
export function removeWidget(l: ShellLayout, id: string): ShellLayout {
  const removed = l.widgets.find((w) => w.id === id);
  if (!removed) return l;
  const kept = l.widgets.filter((w) => w.id !== id);
  const segSorted = kept.filter((w) => w.segment === removed.segment).sort((a, b) => a.order - b.order);
  const orderMap = new Map(segSorted.map((w, i) => [w.id, i] as const));
  return {
    ...l,
    focusedWidgetId: l.focusedWidgetId === id ? null : l.focusedWidgetId,
    widgets: kept.map((w) => (orderMap.has(w.id) ? { ...w, order: orderMap.get(w.id)! } : w)),
  };
}
```

- [ ] **Step 5: Add the store actions**

In `lib/console/store.ts`, add two actions to the `shellLayoutStore` object (after `stage`):

```ts
  focus(id: string) { state = R.setFocus(state, id); emit(); },
  unfocus() { state = R.setFocus(state, null); emit(); },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/focus-reducer.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/console/types.ts lib/console/reducers.ts lib/console/store.ts tests/unit/focus-reducer.test.ts
git commit -m "feat(console): focus state — focusedWidgetId on ShellLayout + setFocus reducer + store actions"
```

---

## Task 2: Persist & sanitize focus

**Files:**
- Modify: `lib/console/sanitize.ts`
- Test: `tests/unit/sanitize-focus.test.ts`

**Interfaces:**
- Consumes: `sanitizeLayout(raw: unknown): ShellLayout | null` (existing).
- Produces: `sanitizeLayout` now preserves `focusedWidgetId` **only** when it matches a surviving widget id; otherwise `null`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/sanitize-focus.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeLayout } from "@/lib/console/sanitize";

const base = {
  segments: { left: { size: 320, collapsed: false }, right: { size: 320, collapsed: false }, bottom: { size: 240, collapsed: false } },
  stage: "map2d",
  widgets: [{ id: "w1", type: "events", segment: "left", order: 0, width: 12, height: 240, collapsed: false, config: {} }],
};

describe("sanitizeLayout focus", () => {
  it("keeps a focusedWidgetId that matches a widget", () => {
    const out = sanitizeLayout({ ...base, focusedWidgetId: "w1" });
    expect(out?.focusedWidgetId).toBe("w1");
  });
  it("drops a focusedWidgetId with no matching widget", () => {
    const out = sanitizeLayout({ ...base, focusedWidgetId: "ghost" });
    expect(out?.focusedWidgetId).toBeNull();
  });
  it("defaults missing/invalid focus to null", () => {
    expect(sanitizeLayout({ ...base })?.focusedWidgetId).toBeNull();
    expect(sanitizeLayout({ ...base, focusedWidgetId: 42 })?.focusedWidgetId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sanitize-focus.test.ts`
Expected: FAIL — `focusedWidgetId` is `undefined` on the returned object.

- [ ] **Step 3: Implement**

In `lib/console/sanitize.ts`, replace the final `return` with a focus-validating version (the `widgets` array is already built above it):

```ts
  const ids = new Set(widgets.map((w) => w.id));
  const focusedWidgetId =
    typeof r.focusedWidgetId === "string" && ids.has(r.focusedWidgetId) ? r.focusedWidgetId : null;
  return { segments, stage: r.stage as StageId, widgets, focusedWidgetId };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/sanitize-focus.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/console/sanitize.ts tests/unit/sanitize-focus.test.ts
git commit -m "feat(console): sanitize round-trips focusedWidgetId (validated against widget ids)"
```

---

## Task 3: Detail contract + WidgetDetail host

**Files:**
- Modify: `lib/console/registry.ts`
- Create: `components/console/WidgetDetail.tsx`

**Interfaces:**
- Consumes: `WidgetType`, `getWidgetType` (registry); `WidgetInstance` (types); `shellLayoutStore.unfocus()` (Task 1).
- Produces:
  - `WidgetDetailProps { instanceId: string; config: Record<string, unknown> }`
  - `WidgetType.detail?: ComponentType<WidgetDetailProps>`
  - `components/console/WidgetDetail.tsx` default export `WidgetDetail({ instance }: { instance: WidgetInstance })`

- [ ] **Step 1: Extend the registry type**

In `lib/console/registry.ts`, add the props type and the optional field:

```ts
export interface WidgetDetailProps { instanceId: string; config: Record<string, unknown> }

export interface WidgetType {
  id: string;
  title: string;
  icon: string;
  category: string;
  defaultHeight: number;
  defaultConfig: Record<string, unknown>;
  component: ComponentType<WidgetBodyProps>;
  /** Optional rich "focus" view shown when the widget is expanded onto the center stage. */
  detail?: ComponentType<WidgetDetailProps>;
  capabilities?: { filter?: boolean; sort?: boolean };
}
```

- [ ] **Step 2: Create the host component**

```tsx
// components/console/WidgetDetail.tsx
"use client";
// Renders the focused widget on the center stage: a header (back-to-map + title)
// plus the widget's bespoke `detail` component, or a generic fallback (the normal
// widget body at full size) so no expand button is ever dead.
import type { WidgetInstance } from "@/lib/console/types";
import { getWidgetType, type WidgetType } from "@/lib/console/registry";
import { shellLayoutStore } from "@/lib/console/store";

export default function WidgetDetail({ instance }: { instance: WidgetInstance }) {
  const type = getWidgetType(instance.type);
  if (!type) return null;
  const Detail = type.detail;
  return (
    <div className="tn-detail" role="region" aria-label={`${type.title} — expanded`}>
      <header className="tn-detail-head">
        <button className="tn-detail-back" onClick={() => shellLayoutStore.unfocus()}>← Back to map</button>
        <span className="tn-detail-icon" aria-hidden>{type.icon}</span>
        <span className="tn-detail-title">{type.title}</span>
      </header>
      <div className="tn-detail-body">
        {Detail
          ? <Detail instanceId={instance.id} config={instance.config} />
          : <GenericDetail type={type} instance={instance} />}
      </div>
    </div>
  );
}

function GenericDetail({ type, instance }: { type: WidgetType; instance: WidgetInstance }) {
  const Body = type.component; // report() falls back to the no-op default context — safe here
  return <div className="tn-detail-generic"><Body instanceId={instance.id} config={instance.config} /></div>;
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (the component is not yet mounted — Task 4 wires it in).

- [ ] **Step 4: Commit**

```bash
git add lib/console/registry.ts components/console/WidgetDetail.tsx
git commit -m "feat(console): WidgetType.detail contract + WidgetDetail host (generic fallback)"
```

---

## Task 4: Wire the focus UI (expand → stage → back)

**Files:**
- Modify: `components/console/StageHost.tsx`
- Modify: `components/console/StageSwitch.tsx`
- Modify: `components/console/WidgetFrame.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `useShellLayout()` (store), `getWidgetType` (registry), `WidgetDetail` (Task 3), `shellLayoutStore.focus/unfocus/stage`.
- Produces: a working expand→focus→back loop on the center stage.

- [ ] **Step 1: Add the focus branch to StageHost**

Replace `components/console/StageHost.tsx` with:

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { StageId } from "@/lib/console/types";
import { viewModeStore } from "@/lib/shell/viewMode";
import { useShellLayout } from "@/lib/console/store";
import { getWidgetType } from "@/lib/console/registry";
import WorldClock from "@/components/console/WorldClock";
import WidgetDetail from "@/components/console/WidgetDetail";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function StageHost({ stage }: { stage: StageId }) {
  const { focusedWidgetId, widgets } = useShellLayout();
  // The map reads viewModeStore for its MapLibre projection: 3D=globe(explore), 2D=flat(console).
  useEffect(() => {
    if (stage === "map3d") viewModeStore.set("explore");
    else if (stage === "map2d") viewModeStore.set("console");
  }, [stage]);

  const focused = focusedWidgetId
    ? widgets.find((w) => w.id === focusedWidgetId && getWidgetType(w.type))
    : undefined;
  if (focused) return <WidgetDetail instance={focused} />;
  if (stage === "clock") return <WorldClock />;
  return <WorldMap />;
}
```

- [ ] **Step 2: Add the FOCUS chip to StageSwitch**

Replace `components/console/StageSwitch.tsx` with:

```tsx
"use client";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import type { StageId } from "@/lib/console/types";

const OPTS: { id: StageId; label: string }[] = [
  { id: "map3d", label: "3D" },
  { id: "map2d", label: "2D" },
  { id: "clock", label: "🕐" },
];

export default function StageSwitch() {
  const { stage, focusedWidgetId } = useShellLayout();
  const focused = focusedWidgetId != null;
  return (
    <div className="tn-stage-switch" role="group" aria-label="Centre stage">
      {OPTS.map((o) => (
        <button
          key={o.id}
          className={!focused && stage === o.id ? "is-on" : ""}
          aria-pressed={!focused && stage === o.id}
          onClick={() => { if (focused) shellLayoutStore.unfocus(); shellLayoutStore.stage(o.id); }}
        >
          {o.label}
        </button>
      ))}
      {focused && <span className="tn-stage-focus is-on" aria-current="true" title="A widget is expanded onto the stage">◱ Focus</span>}
    </div>
  );
}
```

- [ ] **Step 3: Add the expand button to WidgetFrame**

In `components/console/WidgetFrame.tsx`, add an expand button in the header, immediately before the `⋯` menu button (line ~84):

```tsx
        <button className="tn-cw-expand" aria-label="Expand widget" title="Expand to main window" onClick={() => shellLayoutStore.focus(instance.id)}>⤢</button>
        <button className="tn-cw-menu" aria-label="Widget menu" onClick={() => setMenuOpen((o) => !o)}>⋯</button>
```

(`shellLayoutStore` is already imported in this file.)

- [ ] **Step 4: Add the detail-surface styles**

Append to `app/globals.css`:

Also extend the existing borderless-button rule so the new expand button matches the `⋯` menu — change `.tn-cw-menu{…}` to `.tn-cw-menu,.tn-cw-expand{…}`.

```css
/* Focus window — a widget expanded onto the center stage */
/* Use the real theme tokens (--tn-surface-solid / --tn-text) so this is light-default correct. */
.tn-detail { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--tn-surface-solid); color: var(--tn-text); overflow: hidden; }
.tn-detail-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--tn-border, #1e293b); flex: 0 0 auto; }
.tn-detail-back { font: inherit; font-size: 13px; background: transparent; border: 1px solid var(--tn-border, #1e293b); border-radius: 6px; padding: 4px 10px; color: var(--tn-accent, #38bdf8); cursor: pointer; }
.tn-detail-back:hover { background: var(--tn-surface-2, #111a2e); }
.tn-detail-icon { font-size: 16px; }
.tn-detail-title { font-weight: 600; font-size: 15px; }
.tn-detail-body { flex: 1 1 auto; overflow: auto; padding: 14px; }
.tn-detail-generic { max-width: 900px; margin: 0 auto; }
.tn-stage-focus { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px; font-size: 12px; }
```

- [ ] **Step 5: Verify build + focus loop end-to-end (Playwright)**

Run: `npx tsc --noEmit && npm test` → PASS.
Then start the dev server and screenshot the loop:

```bash
npm run dev   # in a background shell
```

Using the Playwright MCP: navigate to `http://localhost:3000`, add an **Events** widget if none is docked, click its **⤢** expand button, confirm the center stage shows the Events detail header ("← Back to map"), screenshot to `persona-shots/focus-events-generic.png`, click **← Back to map**, confirm the globe returns.
Expected: expand replaces the globe with the (generic, for now) Events detail; back restores the map; reloading the page with a widget focused keeps it focused (persisted).

- [ ] **Step 6: Commit**

```bash
git add components/console/StageHost.tsx components/console/StageSwitch.tsx components/console/WidgetFrame.tsx app/globals.css
git commit -m "feat(console): expand-to-stage focus loop — WidgetFrame ⤢ button, StageHost branch, StageSwitch FOCUS chip"
```

---

## Task 5: buckets helper (histogram / countBy / timeBins)

**Files:**
- Create: `lib/widgets/buckets.ts`
- Test: `tests/unit/buckets.test.ts`

**Interfaces:**
- Produces:
  - `countBy<T>(items: T[], key: (t: T) => string): Record<string, number>`
  - `histogram(values: number[], edges: number[]): number[]` (edges ascending, length n+1 → n bins; `[lo, hi)`, last bin `[lo, hi]`)
  - `TimeBin { start: number; count: number }`
  - `timeBins(tsList: number[], binMs: number, now: number, spanMs: number): TimeBin[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/buckets.test.ts
import { describe, it, expect } from "vitest";
import { countBy, histogram, timeBins } from "@/lib/widgets/buckets";

describe("buckets", () => {
  it("countBy tallies by key", () => {
    expect(countBy(["a", "b", "a"], (s) => s)).toEqual({ a: 2, b: 1 });
  });

  it("histogram bins [lo,hi) with an inclusive last edge", () => {
    // edges 0,2,4,6 → bins [0,2) [2,4) [4,6]
    expect(histogram([0, 1, 2, 3, 4, 5, 6], [0, 2, 4, 6])).toEqual([2, 2, 3]);
  });

  it("timeBins buckets timestamps into fixed windows and ignores out-of-range", () => {
    const now = 1_000_000;
    const bins = timeBins([now - 1, now - 3500, now + 999], 1000, now, 3000);
    expect(bins).toHaveLength(3);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(1); // only now-1 is inside [now-3000, now]
    expect(bins[2].count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/buckets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/widgets/buckets.ts
// Pure bucketing helpers for the detail-view distribution/timeline charts.

export function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) { const k = key(it); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

/** edges ascending, length n+1 → n bins. Value v lands in bin i when
 *  edges[i] <= v < edges[i+1]; the LAST bin is inclusive of the top edge. */
export function histogram(values: number[], edges: number[]): number[] {
  const n = Math.max(0, edges.length - 1);
  const bins = new Array<number>(n).fill(0);
  for (const v of values) {
    for (let i = 0; i < n; i++) {
      const lo = edges[i], hi = edges[i + 1];
      const inside = i === n - 1 ? v >= lo && v <= hi : v >= lo && v < hi;
      if (inside) { bins[i]++; break; }
    }
  }
  return bins;
}

export interface TimeBin { start: number; count: number }

/** n = ceil(spanMs/binMs) contiguous bins ending at `now`. Timestamps outside
 *  [now-n*binMs, now] are ignored. */
export function timeBins(tsList: number[], binMs: number, now: number, spanMs: number): TimeBin[] {
  const n = Math.max(1, Math.ceil(spanMs / binMs));
  const start0 = now - n * binMs;
  const bins: TimeBin[] = Array.from({ length: n }, (_, i) => ({ start: start0 + i * binMs, count: 0 }));
  for (const ts of tsList) {
    if (ts < start0 || ts > now) continue;
    const idx = Math.min(n - 1, Math.floor((ts - start0) / binMs));
    bins[idx].count++;
  }
  return bins;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/buckets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/widgets/buckets.ts tests/unit/buckets.test.ts
git commit -m "feat(widgets): pure buckets helper — countBy / histogram / timeBins"
```

---

## Task 6: `<Chart>` primitive (SVG line/area + scale)

**Files:**
- Create: `lib/chart/scale.ts`
- Test: `tests/unit/chart-scale.test.ts`
- Create: `components/Chart.tsx`

**Interfaces:**
- Produces:
  - `extent(values: number[]): [number, number]`
  - `linear(domain: [number, number], range: [number, number]): (x: number) => number`
  - `ChartPoint { x: number; y: number }`
  - `Chart({ points, width, height, area, up }: { points: ChartPoint[]; width?: number; height?: number; area?: boolean; up?: boolean | null })`

> **Scope note:** this plan builds the **line/area** `<Chart>` that W1 (Events recency) exercises. Candlestick mode and the hover crosshair (spec §4) are added in the **Markets (W7)** milestone where they are first needed; the `points`/props surface is designed to accommodate them.

- [ ] **Step 1: Write the failing test (scale maths)**

```ts
// tests/unit/chart-scale.test.ts
import { describe, it, expect } from "vitest";
import { extent, linear } from "@/lib/chart/scale";

describe("chart scale", () => {
  it("extent returns [min,max], padding a flat series", () => {
    expect(extent([3, 1, 2])).toEqual([1, 3]);
    expect(extent([5, 5])).toEqual([4, 6]);
    expect(extent([])).toEqual([0, 1]);
  });

  it("linear maps domain onto range", () => {
    const s = linear([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  it("linear is flat when the domain is degenerate", () => {
    const s = linear([4, 4], [0, 100]);
    expect(s(4)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/chart-scale.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the scale helpers**

```ts
// lib/chart/scale.ts
// Pure 1-D scale maths shared by the native SVG charts. No DOM, node-testable.

export function extent(values: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!Number.isFinite(lo)) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
}

export function linear(domain: [number, number], range: [number, number]): (x: number) => number {
  const [d0, d1] = domain, [r0, r1] = range;
  const m = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (x) => r0 + (x - d0) * m;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/chart-scale.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the Chart component**

```tsx
// components/Chart.tsx
// Native SVG line/area chart — the shared, dependency-free charting primitive
// (generalises Sparkline). Presentational: caller supplies {x,y} points already
// in data space. Renders nothing below 2 points. up tints the stroke green/red.
import { extent, linear } from "@/lib/chart/scale";

export interface ChartPoint { x: number; y: number }

export function Chart({
  points,
  width = 640,
  height = 200,
  area = true,
  up,
}: {
  points: ChartPoint[];
  width?: number;
  height?: number;
  area?: boolean;
  up?: boolean | null;
}) {
  if (!points || points.length < 2) return null;
  const pad = 6;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const sx = linear(extent(xs), [pad, width - pad]);
  const sy = linear(extent([0, ...ys]), [height - pad, pad]); // baseline at 0
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const stroke = up == null ? "var(--tn-accent, #38bdf8)" : up ? "#16a34a" : "#dc2626";
  const fillPath = `${line} L${sx(points[points.length - 1].x).toFixed(1)},${(height - pad).toFixed(1)} L${sx(points[0].x).toFixed(1)},${(height - pad).toFixed(1)} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="tn-chart" preserveAspectRatio="none" role="img">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--tn-border, #1e293b)" strokeWidth="1" />
      {area && <path d={fillPath} fill={stroke} opacity="0.12" />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (component is exercised in Task 10).

- [ ] **Step 7: Commit**

```bash
git add lib/chart/scale.ts tests/unit/chart-scale.test.ts components/Chart.tsx
git commit -m "feat: native SVG <Chart> (line/area) + pure scale helpers"
```

---

## Task 7: `<InsetMap>` primitive (single-layer MapLibre)

**Files:**
- Create: `lib/map/inset.ts`
- Test: `tests/unit/map-inset.test.ts`
- Create: `components/InsetMap.tsx`

**Interfaces:**
- Produces:
  - `InsetPoint { lat: number; lon: number; id?: string; color?: string; props?: Record<string, unknown> }`
  - `pointsToFC(points: InsetPoint[]): GeoJSON.FeatureCollection`
  - `boundsOf(points: InsetPoint[]): [[number, number], [number, number]] | null` (`[[west,south],[east,north]]`)
  - `InsetMap({ points, height, onSelect }: { points: InsetPoint[]; height?: number; onSelect?: (id: string) => void })`

- [ ] **Step 1: Write the failing test (pure helpers)**

```ts
// tests/unit/map-inset.test.ts
import { describe, it, expect } from "vitest";
import { pointsToFC, boundsOf } from "@/lib/map/inset";

describe("inset map helpers", () => {
  it("pointsToFC builds [lon,lat] point features and drops non-finite coords", () => {
    const fc = pointsToFC([{ lat: 10, lon: 20, id: "a" }, { lat: NaN, lon: 5, id: "b" }]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({ type: "Point", coordinates: [20, 10] });
    expect(fc.features[0].properties).toMatchObject({ id: "a" });
  });

  it("boundsOf returns [[w,s],[e,n]] or null when empty", () => {
    expect(boundsOf([{ lat: 10, lon: 20 }, { lat: -5, lon: 40 }])).toEqual([[20, -5], [40, 10]]);
    expect(boundsOf([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/map-inset.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure helpers**

```ts
// lib/map/inset.ts
// Pure GeoJSON + bounds helpers for the shared <InsetMap>. Node-testable.

export interface InsetPoint {
  lat: number;
  lon: number;
  id?: string;
  color?: string;
  props?: Record<string, unknown>;
}

export function pointsToFC(points: InsetPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { id: p.id ?? "", color: p.color ?? "#38bdf8", ...(p.props ?? {}) },
      })),
  };
}

export function boundsOf(points: InsetPoint[]): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if (p.lon < w) w = p.lon; if (p.lon > e) e = p.lon;
    if (p.lat < s) s = p.lat; if (p.lat > n) n = p.lat;
  }
  if (!Number.isFinite(w)) return null;
  return [[w, s], [e, n]];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/map-inset.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the InsetMap component**

Mirrors the WorldMap MapLibre init (`components/WorldMap.tsx:14-16`) but is a small, flat, single-layer map. Uses the keyless CARTO Positron style.

```tsx
// components/InsetMap.tsx
"use client";
// A small, single-layer MapLibre map for detail views: renders one set of point
// features on the keyless CARTO Positron basemap, auto-fits to their bounds, and
// calls onSelect(id) when a point is clicked. Dependency-free beyond maplibre-gl
// (already used by the globe). NOT the 1379-line WorldMap — deliberately minimal.
import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pointsToFC, boundsOf, type InsetPoint } from "@/lib/map/inset";

const SRC = "inset-points";
const LAYER = "inset-point-circles";
const POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export default function InsetMap({
  points,
  height = 320,
  onSelect,
}: {
  points: InsetPoint[];
  height?: number;
  onSelect?: (id: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: boxRef.current,
      style: POSITRON,
      center: [0, 20],
      zoom: 1,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource(SRC, { type: "geojson", data: pointsToFC(points) });
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#0b1220",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      });
      map.on("click", LAYER, (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string" && id) selectRef.current?.(id);
      });
      map.on("mouseenter", LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", LAYER, () => { map.getCanvas().style.cursor = ""; });
      fit(map, points);
    });
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new features + refit when points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    if (src) { src.setData(pointsToFC(points)); fit(map, points); }
  }, [points]);

  return <div ref={boxRef} className="tn-inset-map" style={{ width: "100%", height }} />;
}

function fit(map: maplibregl.Map, points: InsetPoint[]) {
  const b = boundsOf(points);
  if (b) map.fitBounds(b, { padding: 40, maxZoom: 6, duration: 0 });
}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (component is exercised in Task 10).

- [ ] **Step 7: Commit**

```bash
git add lib/map/inset.ts tests/unit/map-inset.test.ts components/InsetMap.tsx
git commit -m "feat(map): shared <InsetMap> (single-layer MapLibre) + pure FC/bounds helpers"
```

---

## Task 8: eventMetricLine (per-domain metric strings)

**Files:**
- Create: `lib/widgets/eventMetrics.ts`
- Test: `tests/unit/event-metrics.test.ts`

**Interfaces:**
- Consumes: `EventType` (`lib/events/model.ts`).
- Produces: `eventMetricLine(type: EventType, props: Record<string, unknown> | undefined): string` — an honest, domain-specific one-liner from the RAW `SignalFeature.props`; `""` when nothing usable is present.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/event-metrics.test.ts
import { describe, it, expect } from "vitest";
import { eventMetricLine } from "@/lib/widgets/eventMetrics";

describe("eventMetricLine", () => {
  it("quake: magnitude + depth", () => {
    expect(eventMetricLine("quake", { magnitude: 5.2, depth: "12.3 km" })).toBe("M 5.2 · depth 12.3 km");
  });
  it("cyclone: category + wind + pressure + movement", () => {
    expect(eventMetricLine("cyclone", { category: "Cat 3 hurricane", maxWind: "90 kt", pressure: "960 mb", movement: "315° at 12 kt" }))
      .toBe("Cat 3 hurricane · 90 kt · 960 mb · moving 315° at 12 kt");
  });
  it("disaster: alert level + country + ongoing (no fake magnitude)", () => {
    expect(eventMetricLine("disaster", { alertLevel: "Red", country: "Nigeria", ongoing: "yes" }))
      .toBe("Red alert · Nigeria · ongoing");
  });
  it("returns empty string when nothing usable is present", () => {
    expect(eventMetricLine("other", undefined)).toBe("");
    expect(eventMetricLine("disaster", {})).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/event-metrics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/widgets/eventMetrics.ts
// Pure: RAW SignalFeature props → an honest, domain-specific metric line for the
// Events detail feed. Only shows what the source actually provides — no fabricated
// unified "magnitude" for cyclones/disasters (their native fields are shown instead).
import type { EventType } from "@/lib/events/model";

const str = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

export function eventMetricLine(type: EventType, props: Record<string, unknown> | undefined): string {
  if (!props) return "";
  const parts: string[] = [];
  if (type === "quake") {
    const m = str(props.magnitude);
    if (m) parts.push(`M ${m}`);
    const d = str(props.depth);
    if (d) parts.push(`depth ${d}`);
  } else if (type === "cyclone") {
    for (const key of ["category", "maxWind", "pressure"] as const) {
      const v = str(props[key]);
      if (v) parts.push(v);
    }
    const mv = str(props.movement);
    if (mv) parts.push(`moving ${mv}`);
  } else if (type === "disaster") {
    const al = str(props.alertLevel);
    if (al) parts.push(`${al} alert`);
    const c = str(props.country);
    if (c) parts.push(c);
    if (str(props.ongoing).toLowerCase() === "yes") parts.push("ongoing");
  } else {
    const m = str(props.magnitude);
    if (m) parts.push(`M ${m}`);
  }
  return parts.join(" · ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/event-metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/widgets/eventMetrics.ts tests/unit/event-metrics.test.ts
git commit -m "feat(widgets): eventMetricLine — honest per-domain event metrics from raw props"
```

---

## Task 9: Events detail — header counts + grouped feed

**Files:**
- Create: `lib/console/widgets/events.detail.tsx`
- Modify: `lib/console/widgets/events.tsx`

**Interfaces:**
- Consumes: `WidgetDetailProps` (registry); `useScope`, `useTimeWindow`/`windowMsFor`, `useNow`, `useEventFeeds`, `projectEventFeed`, `EVENT_SOURCES`, `SEVERITY_COLOR`, `countBy` (Task 5), `eventMetricLine` (Task 8).
- Produces: `EventsDetail(props: WidgetDetailProps)` default export, attached as `EVENTS_WIDGET.detail`.

- [ ] **Step 1: Create the detail component (header + grouped feed)**

```tsx
// lib/console/widgets/events.detail.tsx
"use client";
// Events focus view. Reuses the SAME feed pipeline as the docked widget
// (useEventFeeds → projectEventFeed) but renders deep: a tier/type triage header,
// a feed grouped by event type with honest per-domain metric lines joined back to
// the raw SignalFeature props, and (Task 10/11) a recency chart, event map and export.
import { useMemo } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { EVENT_SOURCES } from "@/lib/events/sources";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedInput } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { useTimeWindow, windowMsFor } from "@/lib/shell/timeWindow";
import { useNow } from "@/lib/shell/useNow";
import { SEVERITY_COLOR, type SeverityTier, type EventType } from "@/lib/events/model";
import type { SignalFeature } from "@/lib/signals/types";
import { countBy } from "@/lib/widgets/buckets";
import { eventMetricLine } from "@/lib/widgets/eventMetrics";

const TIERS: SeverityTier[] = ["S4", "S3", "S2", "S1", "S0"];
const TYPE_LABEL: Partial<Record<EventType, string>> = { quake: "Quakes", disaster: "Disasters", cyclone: "Cyclones" };

export default function EventsDetail({ config }: WidgetDetailProps) {
  const scope = useScope();
  const win = useTimeWindow();
  const now = useNow(60_000);
  const { bySource, status, updatedAt } = useEventFeeds();

  const inputs: FeedInput[] = useMemo(
    () => EVENT_SOURCES.map((source) => ({ source, features: bySource[source.id] ?? [] })),
    [bySource],
  );
  const minTier = ((config.minTier as string) ?? "S1") as SeverityTier;

  const projected = useMemo(
    () => projectEventFeed(inputs, scope, windowMsFor(win), now, { types: null, minTier, sort: "severity" }),
    [inputs, scope, win, now, minTier],
  );

  // Join back to raw props for per-domain metrics (lost in NormalizedEvent).
  const featureById = useMemo(() => {
    const m = new Map<string, SignalFeature>();
    for (const s of EVENT_SOURCES) for (const f of bySource[s.id] ?? []) m.set(f.id, f);
    return m;
  }, [bySource]);

  const tierCounts = useMemo(() => countBy(projected.rows, (e) => e.severity.tier), [projected.rows]);
  const groups = useMemo(() => {
    const by = new Map<EventType, typeof projected.rows>();
    for (const e of projected.rows) { const g = by.get(e.type) ?? []; g.push(e); by.set(e.type, g); }
    return [...by.entries()];
  }, [projected.rows]);

  return (
    <div className="tn-evd">
      <div className="tn-evd-head">
        <div className="tn-evd-stat"><b>{projected.shown}</b> of {projected.total} events</div>
        <div className="tn-evd-scope">{scope.label}{updatedAt ? ` · updated ${Math.round((now - updatedAt) / 60000)}m ago` : ""}</div>
        <div className="tn-evd-tiers">
          {TIERS.map((t) => (
            <span key={t} className="tn-evd-tier" style={{ borderColor: SEVERITY_COLOR[t] }}>
              <i style={{ background: SEVERITY_COLOR[t] }} /> {t} {tierCounts[t] ?? 0}
            </span>
          ))}
        </div>
      </div>

      {status === "loading" && projected.shown === 0 && <p className="tn-w-empty">Loading events…</p>}
      {projected.shown === 0 && status !== "loading" && (
        <p className="tn-w-empty">No events above {minTier} in {scope.label}.</p>
      )}

      {groups.map(([type, rows]) => (
        <section key={type} className="tn-evd-group">
          <h3 className="tn-evd-group-h">{TYPE_LABEL[type] ?? type} · {rows.length}</h3>
          <ul className="tn-evd-list">
            {rows.map((e) => {
              const metric = eventMetricLine(e.type, featureById.get(e.id)?.props);
              return (
                <li key={e.id}>
                  <span className="tn-w-sev" style={{ background: SEVERITY_COLOR[e.severity.tier] }}>{e.severity.tier}</span>{" "}
                  <b>{e.title}</b> <span className="tn-w-place">{e.place.name}</span>
                  {metric && <span className="tn-evd-metric"> · {metric}</span>}
                  {e.link && <a className="tn-evd-src" href={e.link} target="_blank" rel="noreferrer"> source ↗</a>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Attach the detail to the widget + add styles**

In `lib/console/widgets/events.tsx`, import and attach the detail:

```tsx
import EventsDetail from "@/lib/console/widgets/events.detail";
```

Add `detail: EventsDetail` to the `EVENTS_WIDGET` object (after `component: EventsBody`):

```tsx
export const EVENTS_WIDGET = {
  id: "events",
  title: "Disasters & Events",
  icon: "🌎",
  category: "Events",
  defaultHeight: 320,
  defaultConfig: { minTier: "S1", sort: "severity" },
  component: EventsBody,
  detail: EventsDetail,
  capabilities: { filter: true, sort: true },
};
```

Append to `app/globals.css`:

```css
.tn-evd { max-width: 1100px; margin: 0 auto; }
.tn-evd-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-bottom: 12px; }
.tn-evd-stat b { font-size: 20px; }
.tn-evd-scope { color: var(--tn-text-faint, #94a3b8); font-size: 12px; }
.tn-evd-tiers { display: flex; gap: 6px; margin-left: auto; }
.tn-evd-tier { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 2px 8px; border: 1px solid; border-radius: 999px; }
.tn-evd-tier i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.tn-evd-group { margin: 14px 0; }
.tn-evd-group-h { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--tn-text-faint, #94a3b8); margin: 0 0 6px; }
.tn-evd-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.tn-evd-list li { padding: 6px 8px; border-radius: 6px; background: var(--tn-surface-2, #111a2e); }
.tn-evd-metric { color: var(--tn-text-faint, #94a3b8); }
.tn-evd-src { color: var(--tn-accent, #38bdf8); text-decoration: none; font-size: 12px; }
```

- [ ] **Step 3: Verify build + screenshot**

Run: `npx tsc --noEmit && npm test` → PASS.
With the dev server running, expand the Events widget; confirm the detail shows the "N of M events" header, the S4–S0 tier chips with counts, and events grouped under Quakes/Disasters/Cyclones with metric lines. Screenshot to `persona-shots/focus-events-feed.png`.

- [ ] **Step 4: Commit**

```bash
git add lib/console/widgets/events.detail.tsx lib/console/widgets/events.tsx app/globals.css
git commit -m "feat(events): focus detail view — triage header + grouped feed with honest per-domain metrics"
```

---

## Task 10: Events detail — recency chart + event map

**Files:**
- Modify: `lib/console/widgets/events.detail.tsx`

**Interfaces:**
- Consumes: `timeBins` (Task 5), `Chart`/`ChartPoint` (Task 6), `InsetMap`/`InsetPoint` (Task 7).
- Produces: recency `<Chart>` + event `<InsetMap>` panels inside `EventsDetail`.

- [ ] **Step 1: Add imports**

At the top of `lib/console/widgets/events.detail.tsx`:

```tsx
import { timeBins } from "@/lib/widgets/buckets";
import { Chart, type ChartPoint } from "@/components/Chart";
import InsetMap, { } from "@/components/InsetMap";
import type { InsetPoint } from "@/lib/map/inset";
```

- [ ] **Step 2: Derive the chart + map data (inside the component, after `groups`)**

```tsx
  const recency: ChartPoint[] = useMemo(() => {
    const ts = projected.rows
      .map((e) => (e.occurredAt ? Date.parse(e.occurredAt) : NaN))
      .filter((n) => Number.isFinite(n));
    return timeBins(ts, 60 * 60_000, now, 24 * 60 * 60_000).map((b) => ({ x: b.start, y: b.count }));
  }, [projected.rows, now]);

  const mapPoints: InsetPoint[] = useMemo(
    () => projected.rows.map((e) => ({
      lat: e.geo.lat, lon: e.geo.lon, id: e.id, color: e.color,
      props: { title: e.title, tier: e.severity.tier },
    })),
    [projected.rows],
  );
```

- [ ] **Step 3: Render the two panels (after the `<div className="tn-evd-head">` block, before the groups loop)**

```tsx
      <div className="tn-evd-panels">
        <div className="tn-evd-panel">
          <h3 className="tn-evd-group-h">Events over the last 24h</h3>
          {recency.some((p) => p.y > 0)
            ? <Chart points={recency} height={140} up={null} />
            : <p className="tn-w-empty">No timestamped events in the window.</p>}
        </div>
        <div className="tn-evd-panel">
          <h3 className="tn-evd-group-h">Locations</h3>
          {mapPoints.length > 0
            ? <InsetMap points={mapPoints} height={220} />
            : <p className="tn-w-empty">No mappable events right now.</p>}
        </div>
      </div>
```

- [ ] **Step 4: Add panel styles**

Append to `app/globals.css`:

```css
.tn-evd-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.tn-evd-panel { background: var(--tn-surface-2, #111a2e); border-radius: 8px; padding: 10px; }
@media (max-width: 760px) { .tn-evd-panels { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Verify build + screenshot**

Run: `npx tsc --noEmit && npm test` → PASS.
Expand Events; confirm the recency area chart and the inset map of event locations render (or their honest empty states in a quiet window). Screenshot to `persona-shots/focus-events-chart-map.png`.

- [ ] **Step 6: Commit**

```bash
git add lib/console/widgets/events.detail.tsx app/globals.css
git commit -m "feat(events): focus detail — 24h recency <Chart> + event <InsetMap>"
```

---

## Task 11: Events detail — sources footer + export

**Files:**
- Modify: `lib/console/widgets/events.detail.tsx`

**Interfaces:**
- Consumes: `toCsv`, `toGeoJson`, `downloadText`, `exportFilename` (`lib/export.ts`), `EVENT_SOURCES`.
- Produces: a sources/attribution footer with CSV + GeoJSON export of the visible events.

- [ ] **Step 1: Add imports**

```tsx
import { toCsv, toGeoJson, downloadText, exportFilename } from "@/lib/export";
```

- [ ] **Step 2: Build export rows + per-source counts (inside the component)**

```tsx
  const perSource = useMemo(() => {
    const counts = countBy(projected.rows, (e) => e.source.id);
    return EVENT_SOURCES.map((s) => ({ id: s.id, label: s.label, attribution: s.attribution, count: counts[s.id] ?? 0 }));
  }, [projected.rows]);

  const exportRows = useMemo(
    () => projected.rows.map((e) => ({
      tier: e.severity.tier, type: e.type, title: e.title, place: e.place.name,
      metric: eventMetricLine(e.type, featureById.get(e.id)?.props),
      lat: e.geo.lat, lon: e.geo.lon, occurredAt: e.occurredAt ?? "",
    })),
    [projected.rows, featureById],
  );
  const exportGeo = useMemo(
    () => projected.rows.map((e) => ({ lat: e.geo.lat, lon: e.geo.lon, properties: { tier: e.severity.tier, type: e.type, title: e.title } })),
    [projected.rows],
  );
```

- [ ] **Step 3: Render the footer (last child of the outer `tn-evd` div)**

```tsx
      <footer className="tn-evd-foot">
        <div className="tn-evd-sources">
          {perSource.map((s) => (
            <span key={s.id} className="tn-evd-source">{s.label} · {s.count} <i>({s.attribution})</i></span>
          ))}
        </div>
        <div className="tn-evd-export">
          <button
            disabled={exportRows.length === 0}
            onClick={() => downloadText(`${exportFilename("events", Date.now())}.csv`, "text/csv", toCsv(exportRows))}
          >⬇ CSV</button>
          <button
            disabled={exportGeo.length === 0}
            onClick={() => downloadText(`${exportFilename("events", Date.now())}.geojson`, "application/geo+json", toGeoJson(exportGeo))}
          >⬇ GeoJSON</button>
        </div>
      </footer>
```

- [ ] **Step 4: Add footer styles**

Append to `app/globals.css`:

```css
.tn-evd-foot { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--tn-border, #1e293b); display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; }
.tn-evd-sources { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--tn-text-faint, #94a3b8); }
.tn-evd-source i { font-style: normal; opacity: .7; }
.tn-evd-export { margin-left: auto; display: flex; gap: 8px; }
.tn-evd-export button { font: inherit; font-size: 12px; padding: 4px 10px; border: 1px solid var(--tn-border, #1e293b); border-radius: 6px; background: transparent; color: var(--tn-accent, #38bdf8); cursor: pointer; }
.tn-evd-export button:disabled { opacity: .4; cursor: default; }
```

- [ ] **Step 5: Final gate + milestone screenshot**

Run: `npx tsc --noEmit && npm test` → PASS.
Expand Events; confirm the footer lists the three sources with counts + attribution and that **⬇ CSV** downloads a file. Screenshot the full detail to `persona-shots/focus-events-final.png`.

- [ ] **Step 6: Commit**

```bash
git add lib/console/widgets/events.detail.tsx app/globals.css
git commit -m "feat(events): focus detail — sources/attribution footer + CSV/GeoJSON export"
```

---

## Self-Review

**Spec coverage (F1 + F2 + W1 sections of `2026-07-08-focus-window-design.md`):**
- §3 focus foundation → Tasks 1–4 (store field, reducer, sanitize, detail contract, host, wired UI). ✅
- §4 primitives: `buckets` → Task 5; `<Chart>` → Task 6 (line/area; candlestick+crosshair deferred to W7, noted); `<InsetMap>` → Task 7. ✅
- §5 data flow (expand → focusStore → StageHost → detail reusing the data hook) → Tasks 4 + 9. ✅
- §6 honesty/dormant (empty states, no fake magnitude, raw-props join) → Tasks 8–11. ✅
- §7.1 Events detail (triage header, grouped feed w/ per-domain metrics, event map, distribution, sources footer, export) → Tasks 9–11. Severity/type distribution is delivered as the tier-count chips (Task 9) + the 24h recency chart (Task 10); a dedicated magnitude histogram is a W-series follow-up, not required for the "foundation proven" milestone. ✅
- §8 testing (pure logic unit-tested first; UI via Playwright) → every task. ✅

**Placeholder scan:** none — every step has real code/commands.

**Type consistency:** `focusedWidgetId` (types/reducer/sanitize/store) consistent; `WidgetDetailProps {instanceId, config}` used in registry + `EventsDetail`; `ChartPoint {x,y}`, `InsetPoint {lat,lon,id?,color?,props?}`, `TimeBin {start,count}`, `eventMetricLine(type,props)` used with matching signatures across tasks. `EVENT_SOURCES`/`SEVERITY_COLOR`/`projectEventFeed`/`useEventFeeds` match the real source signatures read from the codebase.

**Deferred-with-intent (documented, not gaps):** candlestick + crosshair (`<Chart>`) land in W7 Markets; the magnitude histogram + severity-filter interactions are W-series polish. W2–W8 detail views follow as their own plans per the spec's milestone list.
