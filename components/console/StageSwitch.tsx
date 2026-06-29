"use client";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import type { StageId } from "@/lib/console/types";

const OPTS: { id: StageId; label: string }[] = [
  { id: "map3d", label: "3D" },
  { id: "map2d", label: "2D" },
  { id: "clock", label: "🕐" },
];

export default function StageSwitch() {
  const { stage } = useShellLayout();
  return (
    <div className="tn-stage-switch" role="group" aria-label="Centre stage">
      {OPTS.map((o) => (
        <button
          key={o.id}
          className={stage === o.id ? "is-on" : ""}
          aria-pressed={stage === o.id}
          onClick={() => shellLayoutStore.stage(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
