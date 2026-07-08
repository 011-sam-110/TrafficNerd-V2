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
