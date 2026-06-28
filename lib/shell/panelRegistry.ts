import type { ComponentType } from "react";
import type { PanelKey } from "@/lib/variants/types";
import SourceCatalog from "@/components/shell/SourceCatalog";
import FreshnessTicker from "@/components/shell/FreshnessTicker";
import NewsTicker from "@/components/shell/NewsTicker";
import MarketsPanel from "@/components/shell/MarketsPanel";
import DailyBrief from "@/components/shell/DailyBrief";
import WatchlistPanel from "@/components/shell/WatchlistPanel";
import CoveragePanel from "@/components/shell/CoveragePanel";
import InstabilityPanel from "@/components/shell/InstabilityPanel";
import ConflictPanel from "@/components/shell/ConflictPanel";
import TopEventsPanel from "@/components/shell/TopEventsPanel";
import RiskPanel from "@/components/shell/RiskPanel";

export const PANEL_REGISTRY: Record<PanelKey, {
  component: ComponentType;
  title: string;
  category: "core" | "intelligence" | "markets";
  defaultGrid: { x: number; y: number; w: number; h: number };
}> = {
  layerRail:  { component: SourceCatalog,  title: "Sources",   category: "core",         defaultGrid: { x: 0, y: 0, w: 3, h: 8 } },
  freshness:  { component: FreshnessTicker, title: "Freshness", category: "core",         defaultGrid: { x: 0, y: 8, w: 12, h: 1 } },
  news:       { component: NewsTicker,      title: "News",      category: "intelligence", defaultGrid: { x: 0, y: 7, w: 12, h: 1 } },
  markets:    { component: MarketsPanel,    title: "Markets",   category: "markets",      defaultGrid: { x: 9, y: 0, w: 3, h: 6 } },
  brief:      { component: DailyBrief,      title: "Brief",     category: "intelligence", defaultGrid: { x: 9, y: 0, w: 3, h: 6 } },
  watchlist:  { component: WatchlistPanel,  title: "Watchlist", category: "core",         defaultGrid: { x: 9, y: 6, w: 3, h: 4 } },
  coverage:   { component: CoveragePanel,   title: "Coverage",  category: "core",         defaultGrid: { x: 9, y: 0, w: 3, h: 6 } },
  instability:{ component: InstabilityPanel, title: "Country Instability", category: "intelligence", defaultGrid: { x: 0, y: 0,  w: 12, h: 6 } },
  conflict:   { component: ConflictPanel,    title: "Armed Conflict",      category: "intelligence", defaultGrid: { x: 0, y: 6,  w: 12, h: 6 } },
  topEvents:  { component: TopEventsPanel,   title: "Top Events",          category: "intelligence", defaultGrid: { x: 0, y: 12, w: 12, h: 6 } },
  risk:       { component: RiskPanel,        title: "Strategic Risk",      category: "intelligence", defaultGrid: { x: 0, y: 18, w: 12, h: 3 } },
};

/** Panels PanelHost mounts directly in SP1a (the persistent chrome). */
export const PERSISTENT_PANELS: PanelKey[] = ["layerRail", "freshness", "news"];
