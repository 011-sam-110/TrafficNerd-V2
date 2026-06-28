"use client";
// Phase-1 host: a static flow of placed monitor widgets, docked over the still
// full-bleed globe (the map becomes a real grid tile in Phase 3). Renders nothing
// until the user adds a widget, so the calm default is unchanged. Drag/resize/save
// arrive in Phase 2 (react-grid-layout) — this seam (render-by-key) is what it wraps.

import { usePlacement } from "@/lib/widgets/placement";
import WidgetHost from "@/components/shell/WidgetHost";

export default function Workspace() {
  const keys = usePlacement();
  if (keys.length === 0) return null;
  return (
    <div className="tn-workspace" aria-label="Widget workspace">
      {keys.map((k) => (
        <div key={k} className="tn-tile">
          <WidgetHost widgetKey={k} />
        </div>
      ))}
    </div>
  );
}
