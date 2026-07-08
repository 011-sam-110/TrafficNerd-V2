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
