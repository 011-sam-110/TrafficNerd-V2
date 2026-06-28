"use client";
// Phase-1 host: a static flow of placed monitor widgets, docked over the still
// full-bleed globe (the map becomes a real grid tile in a later phase). Renders
// nothing until the user adds a widget, so the calm default is unchanged.

import { usePlacement } from "@/lib/widgets/placement";
import { widgetForKey } from "@/lib/widgets/registry";
import WidgetHost from "@/components/shell/WidgetHost";

export default function Workspace() {
  const keys = usePlacement();
  // Only render keys that resolve to a known widget — a stale persisted key
  // (renamed group / removed source) must not leave an empty ghost tile.
  const live = keys.filter((k) => widgetForKey(k));
  if (live.length === 0) return null;
  return (
    <div className="tn-workspace" aria-label="Widget workspace">
      {live.map((k) => (
        <div key={k} className="tn-tile">
          <WidgetHost widgetKey={k} />
        </div>
      ))}
    </div>
  );
}
