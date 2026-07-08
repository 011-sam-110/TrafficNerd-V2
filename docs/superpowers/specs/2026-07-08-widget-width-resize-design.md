# Design: Per-widget width resize in the calm console

**Date:** 2026-07-08
**Status:** Approved (brainstorming), ready for implementation plan
**Scope:** The live "calm console" widget system (`components/console/` + `lib/console/`). Does **not** touch the dormant `react-grid-layout` `DockableWorkspace`.

## Problem

Console widgets are already drag-reorderable, movable across segments, collapsible, and **height-resizable** (bottom-edge handle → `setWidgetHeight`, clamped 120–1200 px). What they can't do is set their own **width**: a widget's width is just its segment's width, so every widget in a column is the same width and widgets can never sit side-by-side. The user wants "all widgets can be resized" to mean **width too**, while keeping the calm-console identity (drag/reorder, presets, localStorage + share-URL persistence, all ~34 signal widgets) intact — i.e. *not* the full 2D `react-grid-layout` rip-out.

## Approach: a 12-column grid per segment + a `width` span field

Each segment (`left`, `right`, `bottom`) becomes a **12-column CSS grid** instead of a single vertical flex stack. Every widget gains a `width` = an integer **column span 1–12**.

- **Default `width = 12` (full row)** ⇒ one widget per row ⇒ byte-for-byte today's layout. Nothing changes visually until a user resizes something.
- Two widgets at span 6 sit side-by-side; three at span 4 = 3-up, etc. Resize **snaps to whole 12ths** — tidy, "calm", no ragged fractional widths.
- **Min span = 3** (quarter), max = 12. Both are one-line constants (`MIN_WIDGET_SPAN`, `WIDGET_COLS`) we can tune.
- Widget **order is preserved** (`grid-auto-flow: row`, not `dense`) so reorder/drag stays predictable.

### Known limitations (accepted for v1)

- **Side-by-side is only useful in a wide area** — the bottom segment, or a side column the user has widened via the existing `.tn-grip`. In a default ~320 px side column, a half-width widget is cramped, so users will keep those full-width. The model is uniform; it just shines where there's room.
- **Mixed-height rows leave whitespace** under the shorter card until the row advances (CSS grid isn't masonry). Acceptable for a calm console; true masonry would need the RGL path we deliberately avoided.
- **Mobile:** below a breakpoint, force every widget to span 12 (full width) so phones stay usable.

## Data model changes

**`lib/console/types.ts`** — add one field to `WidgetInstance`:

```ts
export interface WidgetInstance {
  id: string;
  type: WidgetTypeId;
  segment: SegmentId;
  order: number;
  width: number;        // NEW: column span 1..12 of a 12-col segment grid; user-resizable
  height: number;       // px; user-resizable
  collapsed: boolean;
  config: Record<string, unknown>;
}
```

`WidgetType` (registry) gains optional `defaultWidth?: number` (default 12) so a widget type can opt into a smaller default.

## New pure module: `lib/console/resize.ts`

Isolated, unit-testable constants + geometry (mirrors how this repo already extracts pure helpers like `pageStarts`):

```ts
export const WIDGET_COLS = 12;
export const MIN_WIDGET_SPAN = 3;

export const clampSpan = (n: number) =>
  Math.max(MIN_WIDGET_SPAN, Math.min(WIDGET_COLS, Math.round(n)));

/** Snap a pointer-drag on a widget's right edge to a whole column span.
 *  slotLeft = the widget slot's left px; segWidth = the .tn-seg content-box
 *  width; both captured on pointerdown. */
export function spanFromPointer(args: {
  pointerX: number; slotLeft: number; segWidth: number;
}): number {
  const dragged = args.pointerX - args.slotLeft;      // px width the user wants
  const frac = dragged / args.segWidth;               // fraction of the segment
  return clampSpan(frac * WIDGET_COLS);
}
```

## Reducer + store changes

**`lib/console/reducers.ts`**
- `addWidget(...)`: set `width: opts.width ?? 12` on the new instance (alongside the existing `height` default).
- New reducer `setWidgetWidth(l, id, span)` → clamps via `clampSpan`, mirrors `setWidgetHeight`.

**`lib/console/store.ts`**
- New method `resizeWidth(id, span)` → `R.setWidgetWidth`; `emit()` persists (same as `resizeWidget` for height).
- `add(...)` opts gains `width?: number`, forwarded to `addWidget`.

## Component changes

**`components/console/Segment.tsx`**
- Container `.tn-seg` becomes the 12-col grid (CSS below).
- Each grid item (`.tn-seg-slot`) gets `style={{ gridColumn: \`span ${w.width}\` }}`.
- **2D-aware drop math (required):** the current `onDrop` picks the insert index by comparing `e.clientY` to each card's vertical midpoint — that assumes a single vertical stack and breaks once cards wrap into rows. Replace with a nearest-card computation: for each `[data-widget-id]` card, measure its center; insert before the card whose center is closest to the pointer (row-aware: compare `clientY` to row bands, then `clientX` within the row), else append. Extract the index math as a pure helper (e.g. `dropIndex(pointer, rects)`) in `resize.ts` so it's testable.

**`components/console/WidgetFrame.tsx`**
- Keep the existing bottom-edge handle (`.tn-cw-resize`) = height only, unchanged.
- Add a **right-edge handle** (width only) and a **bottom-right corner handle** (both). All three share pointer logic:
  - Width path: on pointerdown capture the `.tn-seg` content-box width (`segWidth`) and the slot's `left` (`slotLeft`). On pointermove call `shellLayoutStore.resizeWidth(id, spanFromPointer({ pointerX, slotLeft, segWidth }))`.
  - Height path: existing `startH + dy` → `shellLayoutStore.resizeWidget(id, h)`.
  - Corner: run both.
- The `width` (`gridColumn`) lives on the slot in `Segment.tsx`; `height` stays inline on `.tn-cw`. Handles read live `instance.width`/`instance.height`.

## CSS (`app/globals.css`)

```css
.tn-seg {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 8px;
  align-items: start;          /* short card in a tall row keeps its own height */
  align-content: start;
}
.tn-seg-slot { grid-column: span 12; }   /* default; overridden inline per-widget */

/* new handles */
.tn-cw-resize-x { /* right edge: col-resize cursor */ }
.tn-cw-resize-xy { /* bottom-right corner: nwse-resize cursor */ }

@media (max-width: 720px) {
  .tn-seg-slot { grid-column: span 12 !important; }  /* force full width on mobile */
}
```

Because every widget defaults to `span 12`, the grid renders identically to today's single-column flex until a user resizes.

## Persistence & migration

- **`lib/console/sanitize.ts`**: in the widget loop, add `width: clampSpan(num(o.width, 12))`. This **backfills legacy layouts** — old `tn.console.v1` localStorage and shared `?c=` URLs (no `width`) load as full-width; out-of-range values are clamped. No version bump, no forced reset, no data loss.
- **Share URL** (`lib/console/share.ts`): `width` is a field on `ShellLayout.widgets`, so it round-trips automatically; decode is covered by sanitize.
- **Presets** (`lib/console/presets.ts`): applied via `shellLayoutStore.replace()`, which runs `sanitizeLayout`, so preset widgets without `width` are safely backfilled to 12. *Optional polish:* set `width` on a couple of builtin presets for a nice default 2-up (e.g. Markets + World Headlines side-by-side in the bottom segment).

## Testing

**Unit (vitest, matching existing style):**
- `clampSpan` / `MIN_WIDGET_SPAN` bounds; `spanFromPointer` snapping across the segment width; `dropIndex` 2D ordering.
- `setWidgetWidth` reducer clamps to [3, 12].
- `sanitizeLayout` backfills `width = 12` for legacy widgets and clamps out-of-range; existing sanitize tests still pass.
- `addWidget` sets `width` default.
- Share encode→decode round-trips `width`.

**Playwright smoke:** add two widgets to the bottom segment; drag one's right edge → it snaps to ~half and the second sits beside it; reload → arrangement persists; load a pre-width (legacy) layout → all widgets render full-width.

## Files touched

| File | Change |
|---|---|
| `lib/console/types.ts` | add `width` to `WidgetInstance` |
| `lib/console/resize.ts` | **new** — `WIDGET_COLS`, `MIN_WIDGET_SPAN`, `clampSpan`, `spanFromPointer`, `dropIndex` |
| `lib/console/reducers.ts` | `width` default in `addWidget`; new `setWidgetWidth` |
| `lib/console/registry.ts` | optional `defaultWidth` on `WidgetType` |
| `lib/console/store.ts` | `resizeWidth` method; `add` opts `width?` |
| `lib/console/sanitize.ts` | backfill/clamp `width` |
| `components/console/Segment.tsx` | grid container, per-slot span, 2D drop math |
| `components/console/WidgetFrame.tsx` | right-edge + corner resize handles |
| `app/globals.css` | `.tn-seg` grid, slot span, handle styles, mobile override |
| `lib/console/presets.ts` | *(optional)* widths on 1–2 builtin presets |
| `tests/unit/console-resize.test.ts` | **new**; extend sanitize/share tests |

## Out of scope

- **The launches widget bug** ("showing nothing") — tracked separately, fixed via a systematic-debugging pass after this lands.
- The dormant `react-grid-layout` `DockableWorkspace` — untouched.
- Masonry/true free-form 2D placement.

## Risks

- **Drop-index regression:** the 2D drop math is the trickiest change; the current logic is Y-only. Mitigated by extracting `dropIndex` as a pure, unit-tested function.
- **Grid vs. per-widget height interaction:** `align-items: start` keeps each card its own height; verify collapsed widgets (which drop their inline height) still grid correctly.
- **Narrow-column cramping:** documented limitation, not a blocker; mobile override + min-span guard keep it from breaking layout.
