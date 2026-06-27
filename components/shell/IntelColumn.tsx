"use client";
// The always-on intel column (WorldMonitor-style permanent right rail). Renders the
// active variant's intel WIDGETS as a fixed, scrolling column — visible WITHOUT
// opening the editable workspace. Hidden while the editable dock is open (the
// workspace takes over for rearranging) so a panel never double-mounts. Variants
// with no intel widgets (e.g. Cameras) render nothing here — the map stays calm.

import type { ComponentType } from "react";
import { useVariant, variantStore } from "@/lib/variants/store";
import { useWorkspace } from "@/lib/shell/workspace";
import { PANEL_REGISTRY } from "@/lib/shell/panelRegistry";
import type { PanelKey } from "@/lib/variants/types";

// Only the dock-only intel widgets live in the always-on column. markets/coverage/
// watchlist keep their own slide-in behaviour (rendered elsewhere), so they are
// deliberately excluded here to avoid double-mounting.
const COLUMN_PANELS = new Set<PanelKey>(["instability", "conflict", "topEvents", "risk"]);

export default function IntelColumn() {
  const { activeId } = useVariant();
  const ws = useWorkspace();
  if (ws.open) return null; // the editable dock takes over

  const placements = variantStore
    .layoutForVariant(activeId)
    .filter((p) => p.visible && COLUMN_PANELS.has(p.panel))
    .sort((a, b) => a.grid.y - b.grid.y);
  if (placements.length === 0) return null;

  return (
    <aside className="tn-intel-column" aria-label="Intelligence">
      {placements.map((p) => {
        const Cmp = PANEL_REGISTRY[p.panel].component as ComponentType<{ docked?: boolean }>;
        return (
          <section key={p.panel} className="tn-intel-card">
            <Cmp docked />
          </section>
        );
      })}
    </aside>
  );
}
