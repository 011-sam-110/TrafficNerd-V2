"use client";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import type { StageId } from "@/lib/console/types";

// The centre stage is either the globe (3D) or the flat map (2D). The old "clock"
// stage is retired — the world clock is now an ambient overlay on the map, not a
// full-screen stage — so only the two map projections remain switchable here.
const OPTS: { id: StageId; label: string }[] = [
  { id: "map3d", label: "3D" },
  { id: "map2d", label: "2D" },
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
