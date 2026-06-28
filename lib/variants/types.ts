import type { LayerState } from "@/lib/layers";
import type { CameraFilterState } from "@/lib/cameraFilter";
import type { Theme } from "@/lib/shell/ui";

export type PanelKey =
  | "layerRail" | "markets" | "brief"
  | "freshness" | "news" | "watchlist" | "coverage"
  // Intel widgets (data panels surfaced in the dock)
  | "instability" | "conflict" | "topEvents" | "risk";
// NOTE: 'dossier' is intentionally NOT a panel — it is the FeedOverlay slide-in
// (transient, deep-linked via ?obj=), kept as overlay chrome.

export interface PanelPlacement {
  /**
   * A PanelKey for a registered panel, OR a dynamic widget key
   * (`source:<id>` / `rollup:<group>`) resolved by the dock at render time.
   */
  panel: string;
  /** Grid geometry — carried for SP1b (react-grid-layout); unused in SP1a. */
  grid: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  visible: boolean;
}

export interface SignalSelection {
  /** Registry `group` strings, or the sentinel "*" for all groups (intel). */
  groups?: string[];
  ids?: string[];
  exclude?: string[];
}

/** Persisted divergence of the live session from a preset. */
export interface OverrideDelta {
  layers?: Partial<LayerState>;
  signals?: Record<string, boolean>;
  theme?: Theme;
}

export interface Variant {
  id: string;
  builtin: boolean;
  title: string;
  tone?: string;
  accent: string; // hex → --accent
  theme: Theme;
  layers: Partial<LayerState>;
  signals?: SignalSelection;
  panels: PanelPlacement[];
  view?: { lon: number; lat: number; zoom: number };
  cameraFilter?: Partial<CameraFilterState>;
}
