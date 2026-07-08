# Per-Widget Width Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every calm-console widget set its own width (a 1–12 column span) so widgets can sit side-by-side, while keeping today's drag/reorder, presets, and persistence unchanged.

**Architecture:** Each segment (`left`/`right`/`bottom`) becomes a 12-column CSS grid. A new `width` field (span 1–12, default 12 = full row) on `WidgetInstance` drives per-slot `grid-column: span N`. Widget frames gain right-edge and corner resize handles that snap the span to whole 12ths via a pure helper. Legacy saved/shared layouts backfill to full width in `sanitize`, so nothing resets.

**Tech Stack:** Next.js 15 (App Router, TS), React 19, `useSyncExternalStore` console store, vitest, plain CSS in `app/globals.css`.

## Global Constraints

- **Attribution:** commit SOLO — no `Co-Authored-By`/Claude trailer (repo convention for TrafficNerd-V2).
- **Branch:** all work on `feat/widget-width-resize` (already checked out; the design spec is committed there).
- **Backward compatibility:** default `width` MUST be `12` everywhere; a layout with all widths = 12 must render byte-for-byte like today.
- **Span bounds:** span is an integer in `[MIN_WIDGET_SPAN=3, WIDGET_COLS=12]`.
- **Never run `next build` while a `next dev` server is up** (corrupts `.next`). For a safe typecheck+build alongside a running dev server use `TN_DIST_DIR=.next-verify npm run build`.
- **Don't touch** the dormant `react-grid-layout` `DockableWorkspace`, or the launches widget (separate task).
- Tests run with `npx vitest run <path>`; typecheck with `npx tsc --noEmit`.

---

### Task 1: Pure resize helpers (`lib/console/resize.ts`)

Self-contained, dependency-free geometry + constants. Compiles and tests on its own.

**Files:**
- Create: `lib/console/resize.ts`
- Test: `tests/unit/console-resize.test.ts`

**Interfaces:**
- Produces: `WIDGET_COLS: 12`, `MIN_WIDGET_SPAN: 3`, `clampSpan(n: number): number`, `spanFromPointer(args: { pointerX: number; slotLeft: number; segWidth: number }): number`, `dropIndex(p: { x: number; y: number }, rects: Box[]): number`, `interface Box { top; bottom; left; right }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/console-resize.test.ts`:

```ts
import { expect, test } from "vitest";
import { clampSpan, spanFromPointer, dropIndex, WIDGET_COLS, MIN_WIDGET_SPAN } from "@/lib/console/resize";

test("clampSpan rounds and clamps into [MIN_WIDGET_SPAN, 12]", () => {
  expect(clampSpan(6.4)).toBe(6);
  expect(clampSpan(6.6)).toBe(7);
  expect(clampSpan(0)).toBe(MIN_WIDGET_SPAN);
  expect(clampSpan(99)).toBe(WIDGET_COLS);
  expect(clampSpan(NaN)).toBe(WIDGET_COLS);
});

test("spanFromPointer snaps a right-edge drag to a column span", () => {
  expect(spanFromPointer({ pointerX: 600, slotLeft: 0, segWidth: 1200 })).toBe(6);  // half
  expect(spanFromPointer({ pointerX: 1200, slotLeft: 0, segWidth: 1200 })).toBe(12); // full
  expect(spanFromPointer({ pointerX: 40, slotLeft: 0, segWidth: 1200 })).toBe(MIN_WIDGET_SPAN); // tiny → min
  expect(spanFromPointer({ pointerX: 100, slotLeft: 0, segWidth: 0 })).toBe(12); // zero-width guard
});

test("dropIndex returns reading-order insertion index over a wrap grid", () => {
  const A = { top: 0, bottom: 100, left: 0, right: 100 };
  const B = { top: 0, bottom: 100, left: 108, right: 208 };
  const C = { top: 108, bottom: 208, left: 0, right: 100 };
  const rects = [A, B, C];
  expect(dropIndex({ x: 10, y: 50 }, rects)).toBe(0);   // left of A center → before A
  expect(dropIndex({ x: 130, y: 50 }, rects)).toBe(1);  // between A and B centers → before B
  expect(dropIndex({ x: 300, y: 50 }, rects)).toBe(2);  // right of B (end of row 1) → before C
  expect(dropIndex({ x: 10, y: 300 }, rects)).toBe(3);  // below all → append
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/console-resize.test.ts`
Expected: FAIL — cannot resolve `@/lib/console/resize`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/console/resize.ts`:

```ts
export const WIDGET_COLS = 12;
export const MIN_WIDGET_SPAN = 3;

/** Round a raw column count to a valid whole span, clamped to [MIN_WIDGET_SPAN, 12]. */
export function clampSpan(n: number): number {
  const r = Math.round(n);
  if (!Number.isFinite(r)) return WIDGET_COLS;
  return Math.max(MIN_WIDGET_SPAN, Math.min(WIDGET_COLS, r));
}

/** Snap a right-edge drag to a whole column span.
 *  slotLeft = the widget slot's left px; segWidth = the segment's content-box width px. */
export function spanFromPointer(args: { pointerX: number; slotLeft: number; segWidth: number }): number {
  if (!(args.segWidth > 0)) return WIDGET_COLS;
  const dragged = args.pointerX - args.slotLeft;
  return clampSpan((dragged / args.segWidth) * WIDGET_COLS);
}

export interface Box { top: number; bottom: number; left: number; right: number }

/** Reading-order insert index for a drop over a wrapping grid of cards. */
export function dropIndex(p: { x: number; y: number }, rects: Box[]): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const beforeRow = p.y < r.top;
    const inRow = p.y >= r.top && p.y <= r.bottom;
    const cx = (r.left + r.right) / 2;
    if (beforeRow || (inRow && p.x < cx)) return i;
  }
  return rects.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/console-resize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/console/resize.ts tests/unit/console-resize.test.ts
git commit -m "feat(console): pure width-resize geometry helpers"
```

---

### Task 2: Width in the data model (`types`, `reducers`, `store`, `sanitize`)

Add `width` end-to-end in one task so `tsc` stays green (adding a required field breaks every `WidgetInstance` construction site at once).

**Files:**
- Modify: `lib/console/types.ts` (interface)
- Modify: `lib/console/reducers.ts` (`addWidget` default + new `setWidgetWidth`)
- Modify: `lib/console/store.ts` (`add` opts + new `resizeWidth`)
- Modify: `lib/console/sanitize.ts` (backfill/clamp)
- Test: `tests/unit/console-reducers.test.ts`, `tests/unit/console-sanitize.test.ts`, `tests/unit/console-share.test.ts`

**Interfaces:**
- Consumes: `clampSpan` from `lib/console/resize` (Task 1).
- Produces: `WidgetInstance.width: number`; `setWidgetWidth(l, id, width): ShellLayout`; `shellLayoutStore.resizeWidth(id, span): void`; `addWidget` opts `{ …, width?: number }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/console-reducers.test.ts` (add `setWidgetWidth` to the existing import from `@/lib/console/reducers`):

```ts
test("addWidget sets a default full width of 12", () => {
  const l = addWidget(createDefaultLayout(), "aviation", "a");
  expect(l.widgets[0].width).toBe(12);
});

test("setWidgetWidth clamps the span into [3,12]", () => {
  let l = addWidget(createDefaultLayout(), "aviation", "a");
  l = setWidgetWidth(l, "a", 6);
  expect(l.widgets[0].width).toBe(6);
  l = setWidgetWidth(l, "a", 1);
  expect(l.widgets[0].width).toBe(3);   // below min → 3
  l = setWidgetWidth(l, "a", 99);
  expect(l.widgets[0].width).toBe(12);  // above max → 12
});
```

Append to `tests/unit/console-sanitize.test.ts`:

```ts
test("sanitizeLayout backfills width=12 for legacy widgets and clamps out-of-range", () => {
  const out = sanitizeLayout({
    segments: {}, stage: "map2d",
    widgets: [
      { id: "a", type: "clock" },              // legacy, no width
      { id: "b", type: "clock", width: 1 },    // below min
      { id: "c", type: "clock", width: 99 },   // above max
      { id: "d", type: "clock", width: 6 },    // valid
    ],
  });
  const byId = Object.fromEntries(out!.widgets.map((w) => [w.id, w.width]));
  expect(byId.a).toBe(12);
  expect(byId.b).toBe(3);
  expect(byId.c).toBe(12);
  expect(byId.d).toBe(6);
});
```

Append to `tests/unit/console-share.test.ts`:

```ts
test("encode→decode round-trips widget width", () => {
  const l = decodeLayout(encodeLayout({
    segments: createDefaultLayout().segments, stage: "map2d",
    widgets: [{ id: "a", type: "clock", segment: "left", order: 0, width: 6, height: 240, collapsed: false, config: {} }],
  } as unknown as ShellLayout));
  expect(l!.widgets[0].width).toBe(6);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/console-reducers.test.ts tests/unit/console-sanitize.test.ts tests/unit/console-share.test.ts`
Expected: FAIL — `setWidgetWidth` not exported / `width` missing on widget objects.

- [ ] **Step 3: Add `width` to the interface**

In `lib/console/types.ts`, add the field to `WidgetInstance` (between `order` and `height`):

```ts
export interface WidgetInstance {
  id: string;
  type: WidgetTypeId;
  segment: SegmentId;
  order: number;
  width: number;        // column span 1..12 of the 12-col segment grid; user-resizable
  height: number;       // px; user-resizable
  collapsed: boolean;
  config: Record<string, unknown>;
}
```

- [ ] **Step 4: Update `reducers.ts`**

Add the import at the top of `lib/console/reducers.ts`:

```ts
import { clampSpan } from "@/lib/console/resize";
```

Change `addWidget`'s `opts` type and the constructed instance:

```ts
export function addWidget(
  l: ShellLayout, type: string, instanceId: string,
  opts: { segment?: SegmentId; config?: Record<string, unknown>; height?: number; width?: number } = {},
): ShellLayout {
  if (isAtCapacity(l)) return l;
  const segment = opts.segment ?? emptiestSegment(l);
  const order = l.widgets.filter((w) => w.segment === segment).length;
  const inst: WidgetInstance = {
    id: instanceId, type, segment, order,
    width: opts.width ?? 12,
    height: opts.height ?? 260, collapsed: false, config: opts.config ?? {},
  };
  return { ...l, widgets: [...l.widgets, inst] };
}
```

Add the reducer next to `setWidgetHeight`:

```ts
export function setWidgetWidth(l: ShellLayout, id: string, width: number): ShellLayout {
  return { ...l, widgets: l.widgets.map((w) => w.id === id ? { ...w, width: clampSpan(width) } : w) };
}
```

- [ ] **Step 5: Update `store.ts`**

In `lib/console/store.ts`, widen the `add` opts type and add a `resizeWidth` method:

```ts
  add(type: string, opts: { segment?: SegmentId; config?: Record<string, unknown>; height?: number; width?: number } = {}) {
    if (R.isAtCapacity(state)) return { ok: false as const };
    const id = nextId();
    state = R.addWidget(state, type, id, opts); emit();
    return { ok: true as const, id };
  },
```

Add after the existing `resizeWidget` line:

```ts
  resizeWidth(id: string, span: number) { state = R.setWidgetWidth(state, id, span); emit(); },
```

- [ ] **Step 6: Update `sanitize.ts`**

In `lib/console/sanitize.ts`, add the import:

```ts
import { clampSpan } from "@/lib/console/resize";
```

Add `width` to the pushed widget (right before `height`):

```ts
    widgets.push({
      id: o.id,
      type: o.type,
      segment: SEGMENTS.includes(o.segment as SegmentId) ? (o.segment as SegmentId) : "left",
      order: num(o.order, widgets.length),
      width: clampSpan(num(o.width, 12)),
      height: clamp(num(o.height, 240), 120, 1200),
      collapsed: o.collapsed === true,
      config: o.config && typeof o.config === "object" ? (o.config as Record<string, unknown>) : {},
    });
```

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run tests/unit/console-reducers.test.ts tests/unit/console-sanitize.test.ts tests/unit/console-share.test.ts && npx tsc --noEmit`
Expected: PASS (new tests green, existing tests still green) and `tsc` reports no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/console/types.ts lib/console/reducers.ts lib/console/store.ts lib/console/sanitize.ts tests/unit/console-reducers.test.ts tests/unit/console-sanitize.test.ts tests/unit/console-share.test.ts
git commit -m "feat(console): add per-widget width span to the layout model"
```

---

### Task 3: Segment becomes a 12-column grid + 2D drop (`Segment.tsx`, CSS)

**Files:**
- Modify: `components/console/Segment.tsx`
- Modify: `app/globals.css` (`.tn-seg`, `.tn-seg-slot`, `.tn-seg-empty` — lines ~1151–1152)

**Interfaces:**
- Consumes: `dropIndex` from `lib/console/resize` (Task 1), `WidgetInstance.width` (Task 2).

- [ ] **Step 1: Rewrite `Segment.tsx` drop math + per-slot span**

Replace the whole file `components/console/Segment.tsx` with:

```tsx
// components/console/Segment.tsx
"use client";
import type { SegmentId } from "@/lib/console/types";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import { widgetsInSegment } from "@/lib/console/reducers";
import { dropIndex } from "@/lib/console/resize";
import WidgetFrame from "@/components/console/WidgetFrame";

export default function Segment({ id }: { id: SegmentId }) {
  const layout = useShellLayout();
  const widgets = widgetsInSegment(layout, id);
  const onDrop = (e: React.DragEvent) => {
    const wid = e.dataTransfer.getData("text/tn-widget");
    if (!wid) return;
    e.preventDefault();
    const cards = [...e.currentTarget.querySelectorAll("[data-widget-id]")] as HTMLElement[];
    const rects = cards.map((c) => c.getBoundingClientRect());
    const idx = dropIndex({ x: e.clientX, y: e.clientY }, rects);
    shellLayoutStore.move(wid, id, idx);
  };
  return (
    <div className="tn-seg" data-segment={id}
         onDragOver={(e) => { if (e.dataTransfer.types.includes("text/tn-widget")) e.preventDefault(); }}
         onDrop={onDrop}>
      {widgets.length === 0 && <p className="tn-seg-empty">Drop a widget here, or add one with ⌘K</p>}
      {widgets.map((w) => (
        <div key={w.id} data-widget-id={w.id} className="tn-seg-slot" style={{ gridColumn: `span ${w.width}` }}>
          <WidgetFrame instance={w} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update the segment CSS**

In `app/globals.css`, replace the two lines (1151–1152):

```css
.tn-seg{flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:8px;padding:8px;background:#eef2f6}
.tn-seg-slot{flex:none}.tn-seg-empty{font-size:11px;color:#9aa6b2;text-align:center;margin:auto;padding:16px}
```

with:

```css
.tn-seg{flex:1;overflow-y:auto;overflow-x:hidden;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-flow:row;align-items:start;align-content:start;gap:8px;padding:8px;background:#eef2f6}
.tn-seg-slot{grid-column:span 12;min-width:0}
.tn-seg-empty{grid-column:1 / -1;font-size:11px;color:#9aa6b2;text-align:center;margin:auto;padding:16px}
```

- [ ] **Step 3: Typecheck + regression tests**

Run: `npx tsc --noEmit && npx vitest run tests/unit/console-resize.test.ts tests/unit/console-reducers.test.ts`
Expected: no `tsc` errors; tests PASS. (Grid rendering is verified visually in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add components/console/Segment.tsx app/globals.css
git commit -m "feat(console): render segments as a 12-column grid with 2D drop"
```

---

### Task 4: Width + corner resize handles (`WidgetFrame.tsx`, CSS)

**Files:**
- Modify: `components/console/WidgetFrame.tsx`
- Modify: `app/globals.css` (`.tn-cw` add `position:relative`; new handle styles near line 1132)

**Interfaces:**
- Consumes: `spanFromPointer` from `lib/console/resize` (Task 1), `shellLayoutStore.resizeWidth` (Task 2).

- [ ] **Step 1: Add the import**

At the top of `components/console/WidgetFrame.tsx`, add:

```ts
import { spanFromPointer } from "@/lib/console/resize";
```

- [ ] **Step 2: Add width + corner pointer handlers**

Keep the existing `onResizePointerDown` (height) unchanged. Directly after it, add a segment-measuring helper and two handlers:

```ts
  const measureSeg = (target: HTMLElement) => {
    const seg = target.closest(".tn-seg") as HTMLElement | null;
    const slot = target.closest(".tn-seg-slot") as HTMLElement | null;
    if (!seg || !slot) return null;
    const cs = getComputedStyle(seg);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    return { slotLeft: slot.getBoundingClientRect().left, segWidth: seg.getBoundingClientRect().width - padL - padR };
  };
  const onResizeWidthPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const m = measureSeg(e.currentTarget as HTMLElement);
    if (!m) return;
    const move = (ev: PointerEvent) =>
      shellLayoutStore.resizeWidth(instance.id, spanFromPointer({ pointerX: ev.clientX, slotLeft: m.slotLeft, segWidth: m.segWidth }));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const onResizeCornerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const m = measureSeg(e.currentTarget as HTMLElement);
    const startY = e.clientY, startH = instance.height;
    const move = (ev: PointerEvent) => {
      shellLayoutStore.resizeWidget(instance.id, startH + (ev.clientY - startY));
      if (m) shellLayoutStore.resizeWidth(instance.id, spanFromPointer({ pointerX: ev.clientX, slotLeft: m.slotLeft, segWidth: m.segWidth }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
```

- [ ] **Step 3: Render the new handles**

In the JSX, replace the single resize handle line:

```tsx
          <div className="tn-cw-resize" onPointerDown={onResizePointerDown} title="Drag to resize" />
```

with all three (order: height bar last as today, plus the absolutely-positioned edge + corner):

```tsx
          <div className="tn-cw-resize" onPointerDown={onResizePointerDown} title="Drag to resize height" />
          <div className="tn-cw-resize-x" onPointerDown={onResizeWidthPointerDown} title="Drag to resize width" />
          <div className="tn-cw-resize-xy" onPointerDown={onResizeCornerPointerDown} title="Drag to resize" />
```

- [ ] **Step 4: Add the handle CSS**

In `app/globals.css`, change line 1117 to add `position:relative`:

```css
.tn-cw{position:relative;display:flex;flex-direction:column;background:#fff;border:1px solid var(--tn-border,#dbe2ea);border-radius:8px;overflow:hidden}
```

And directly after the `.tn-cw-resize{...}` rule (line 1132) add:

```css
.tn-cw-resize-x{position:absolute;top:0;right:0;width:6px;height:100%;cursor:col-resize;z-index:2}
.tn-cw-resize-x:hover{background:rgba(120,140,160,.18)}
.tn-cw-resize-xy{position:absolute;right:0;bottom:0;width:12px;height:12px;cursor:nwse-resize;z-index:3}
.tn-cw-resize-xy::after{content:"";position:absolute;right:2px;bottom:2px;width:6px;height:6px;border-right:2px solid #b3bdc8;border-bottom:2px solid #b3bdc8}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/console/WidgetFrame.tsx app/globals.css
git commit -m "feat(console): width + corner resize handles on widget frames"
```

---

### Task 5: Mobile override, build gate, and live verification

**Files:**
- Modify: `app/globals.css` (mobile media query)

- [ ] **Step 1: Force full width on mobile**

In `app/globals.css`, directly after the `.tn-seg-empty` rule (from Task 3) add:

```css
@media (max-width: 720px){ .tn-seg-slot{ grid-column: span 12 !important; } }
```

- [ ] **Step 2: Full suite + authoritative build**

Ensure no `next dev` server is running, then:

Run: `npx vitest run && npm run build`
(If a dev server IS running, use `npx vitest run && TN_DIST_DIR=.next-verify npm run build` instead.)
Expected: all vitest tests PASS; `next build` completes with no type or lint errors.

- [ ] **Step 3: Live verification in the browser**

Start one dev server (`npm run dev`), open the app, and verify each with the console:

1. **Side-by-side renders.** In the browser console, seed a two-widget bottom layout at half width each and reload:
   ```js
   localStorage.setItem("tn.console.v1", JSON.stringify({ v: 1, data: {
     segments: { left:{size:320,collapsed:false}, right:{size:320,collapsed:false}, bottom:{size:320,collapsed:false} },
     stage: "map2d",
     widgets: [
       { id:"x1", type:"markets",   segment:"bottom", order:0, width:6, height:240, collapsed:false, config:{} },
       { id:"x2", type:"headlines", segment:"bottom", order:1, width:6, height:240, collapsed:false, config:{} },
     ],
   }}));
   location.reload();
   ```
   (If the persist envelope shape differs, read one back first with `JSON.parse(localStorage.getItem("tn.console.v1"))` and match it.) Expected: Markets and World Headlines sit **side-by-side** in the bottom segment, each ~half width.
2. **Resize snaps + persists.** Drag Markets' right-edge handle left → it snaps narrower and Headlines widens/reflows. Reload → the arrangement persists (widths saved).
3. **Legacy layout loads full-width.** Seed a layout whose widgets have **no** `width` key (delete `width` from the objects above) and reload. Expected: both widgets render **full-width, one per row** (backfill to 12), no console errors.
4. **Mobile.** Resize the window below 720px. Expected: all widgets snap to full width.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(console): full-width widgets on mobile; width-resize verified"
```

---

## Deferred / out of scope

- **Preset polish** (a default 2-up like Markets + World Headlines in a builtin preset) — left out; all presets stay full-width per the approved default. Easy follow-up: pass `width` through `compose`/`addWidget` in `lib/console/presets.ts`.
- **Registry `defaultWidth`** — omitted (YAGNI): nothing reads registry defaults for sizing today; `addWidget` defaults width to 12 directly.
- **Launches "showing nothing" bug** — separate systematic-debugging pass after this lands.
- **Masonry / true free-form 2D placement** — the dormant `react-grid-layout` path, deliberately untouched.

## Self-review notes

- **Spec coverage:** 12-col grid (Task 3) ✓; `width` field + default 12 (Task 2) ✓; right/corner/bottom handles + snap (Task 4) ✓; min span 3 / max 12 (Task 1 `clampSpan`) ✓; sanitize backfill + clamp (Task 2) ✓; share round-trip explicitly asserted (Task 2 adds a width round-trip test to `console-share.test.ts`) ✓; 2D drop math (Task 1 `dropIndex`, wired Task 3) ✓; mobile override (Task 5) ✓; order preserved via `grid-auto-flow: row` (Task 3 CSS) ✓.
- **Type consistency:** `setWidgetWidth`/`resizeWidth`/`spanFromPointer`/`dropIndex`/`clampSpan` names are used identically across tasks; `width` field name consistent in types, reducers, sanitize, store opts, and Segment `style`.
- **Placeholder scan:** every code step shows full code; no TBD/TODO.
