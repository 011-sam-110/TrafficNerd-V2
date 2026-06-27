"use client";
// The calm light console shell. Wraps the full-bleed WorldMap (children) with the
// thin chrome that recedes around it: top status bar, left layer rail, bottom
// freshness ticker, the ⌘K palette, and the right slide-in dossier. Owns the
// global ⌘K shortcut and the one-time client hydration of the persisted stores.

import { useEffect, useState } from "react";
import { layersStore } from "@/lib/layers";
import { uiStore } from "@/lib/shell/ui";
import StatusBar from "@/components/shell/StatusBar";
import LayerRail from "@/components/shell/LayerRail";
import FreshnessTicker from "@/components/shell/FreshnessTicker";
import CommandPalette from "@/components/shell/CommandPalette";
import PlaceSearch from "@/components/shell/PlaceSearch";
import CoveragePanel from "@/components/shell/CoveragePanel";
import { FeedOverlay } from "@/components/FeedOverlay";

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Re-hydrate persisted view state once, client-side (render defaults on the
  // server, reconcile after mount → no hydration mismatch).
  useEffect(() => {
    layersStore.hydrate();
    uiStore.hydrate();
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
      <PlaceSearch />
      <LayerRail />
      <FreshnessTicker />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CoveragePanel />
      <FeedOverlay />
    </div>
  );
}
