import {
  createDefaultLayout, MAX_WIDGETS,
  type ShellLayout, type SegmentId, type StageId, type WidgetInstance,
} from "@/lib/console/types";
import { clampSpan } from "@/lib/console/resize";

const SEGMENTS: SegmentId[] = ["left", "right", "bottom"];
const STAGES: StageId[] = ["map3d", "map2d", "clock"];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Coerce arbitrary/untrusted input into a valid ShellLayout, or null if unrecoverable.
 *  Guarantees: all three segment keys present; sizes clamped [0,900]; each widget has a
 *  valid segment, clamped height [120,1200], object config; total widgets <= MAX_WIDGETS. */
export function sanitizeLayout(raw: unknown): ShellLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.widgets)) return null;
  if (typeof r.stage !== "string" || !STAGES.includes(r.stage as StageId)) return null;
  if (!r.segments || typeof r.segments !== "object") return null;

  const base = createDefaultLayout();
  const segsIn = r.segments as Record<string, unknown>;
  const segments = {} as ShellLayout["segments"];
  for (const id of SEGMENTS) {
    const s = segsIn[id] && typeof segsIn[id] === "object" ? (segsIn[id] as Record<string, unknown>) : {};
    segments[id] = {
      size: clamp(num(s.size, base.segments[id].size), 0, 900),
      collapsed: s.collapsed === true,
    };
  }

  const widgets: WidgetInstance[] = [];
  for (const w of r.widgets as unknown[]) {
    if (widgets.length >= MAX_WIDGETS) break;
    if (!w || typeof w !== "object") continue;
    const o = w as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.type !== "string") continue;
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
  }
  return { segments, stage: r.stage as StageId, widgets };
}
