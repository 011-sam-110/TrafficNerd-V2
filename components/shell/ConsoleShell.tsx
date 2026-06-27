"use client";
// The calm light console shell. Wraps the full-bleed WorldMap (children) with the
// thin chrome that recedes around it: top status bar, left layer rail, bottom
// freshness ticker, the ⌘K palette, and the right slide-in dossier. Owns the
// global ⌘K shortcut and the one-time client hydration of the persisted stores.

import { useEffect, useState } from "react";
import { layersStore } from "@/lib/layers";
import { signalsStore } from "@/lib/signals/store";
import { uiStore } from "@/lib/shell/ui";
import { alertStore } from "@/lib/shell/alert";
import { langStore } from "@/lib/i18n/store";
import { watchlistStore } from "@/lib/shell/watchlist";
import { timeWindowStore } from "@/lib/shell/timeWindow";
import { registerServiceWorker } from "@/lib/pwa/register";
import StatusBar from "@/components/shell/StatusBar";
import LayerRail from "@/components/shell/LayerRail";
import FreshnessTicker from "@/components/shell/FreshnessTicker";
import CommandPalette from "@/components/shell/CommandPalette";
import PlaceSearch from "@/components/shell/PlaceSearch";
import CoveragePanel from "@/components/shell/CoveragePanel";
import MarketsPanel from "@/components/shell/MarketsPanel";
import WatchlistPanel from "@/components/shell/WatchlistPanel";
import NewsTicker from "@/components/shell/NewsTicker";
import BreakingBanner from "@/components/shell/BreakingBanner";
import { FeedOverlay } from "@/components/FeedOverlay";

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Re-hydrate persisted view state once, client-side (render defaults on the
  // server, reconcile after mount → no hydration mismatch).
  useEffect(() => {
    layersStore.hydrate();
    signalsStore.hydrate();
    uiStore.hydrate();
    alertStore.hydrate();
    langStore.hydrate();
    watchlistStore.hydrate();
    timeWindowStore.hydrate();
    registerServiceWorker(); // production-only; a no-op under `next dev`
  }, []);

  // Global ⌘K / Ctrl-K toggles the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="tn-shell">
      {children}
      <StatusBar onOpenPalette={() => setPaletteOpen(true)} />
      <BreakingBanner />
      <PlaceSearch />
      <LayerRail />
      <NewsTicker />
      <FreshnessTicker />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CoveragePanel />
      <MarketsPanel />
      <WatchlistPanel />
      <FeedOverlay />
    </div>
  );
}
