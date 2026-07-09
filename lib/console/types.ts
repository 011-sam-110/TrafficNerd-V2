export type SegmentId = "left" | "right" | "bottom";
export type StageId = "map3d" | "map2d" | "clock";
export type WidgetTypeId = string;

export interface WidgetInstance {
  id: string;
  type: WidgetTypeId;
  segment: SegmentId;
  order: number;
  width: number;        // column span 1..12 of the 12-col segment grid; user-resizable
  height: number;       // px; user-resizable
  collapsed: boolean;   // header-only
  config: Record<string, unknown>;
}

export interface SegmentState { size: number; collapsed: boolean }

export interface ShellLayout {
  segments: Record<SegmentId, SegmentState>;
  stage: StageId;
  widgets: WidgetInstance[];
  /** The widget expanded onto the center stage, or null when the map is shown. */
  focusedWidgetId: string | null;
}

export const MAX_WIDGETS = 50;

export function createDefaultLayout(): ShellLayout {
  return {
    segments: {
      left: { size: 300, collapsed: false },
      right: { size: 300, collapsed: false },
      bottom: { size: 220, collapsed: false },
    },
    stage: "map2d",
    widgets: [],
    focusedWidgetId: null,
  };
}

/** Deterministic id (no Math.random — keeps reducers pure/testable). */
export function newInstanceId(seq: number): string {
  return `w${seq.toString(36)}`;
}
