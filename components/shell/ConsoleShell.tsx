"use client";
// The calm light console shell. Wraps the full-bleed WorldMap (children) with the
// thin chrome that recedes around it: a thin top status bar + variant switcher,
// the variant-driven PanelHost, the ⌘K palette, and the right slide-in dossiers.
// Owns the global ⌘K shortcut and the one-time client hydration of the persisted stores.

import { useEffect, useState } from "react";
import { uiStore } from "@/lib/shell/ui";
import { alertStore } from "@/lib/shell/alert";
import { langStore } from "@/lib/i18n/store";
import { watchlistStore } from "@/lib/shell/watchlist";
import { timeWindowStore } from "@/lib/shell/timeWindow";
import { registerServiceWorker } from "@/lib/pwa/register";
import { variantStore } from "@/lib/variants/store";
import { useWorkspace } from "@/lib/shell/workspace";
import StatusBar from "@/components/shell/StatusBar";
import CommandPalette from "@/components/shell/CommandPalette";
import PlaceSearch from "@/components/shell/PlaceSearch";
import CoveragePanel from "@/components/shell/CoveragePanel";
import MarketsPanel from "@/components/shell/MarketsPanel";
import WatchlistPanel from "@/components/shell/WatchlistPanel";
import BreakingBanner from "@/components/shell/BreakingBanner";
import { FeedOverlay } from "@/components/FeedOverlay";
import PanelHost from "@/components/shell/PanelHost";
import DockableWorkspace from "@/components/shell/DockableWorkspace";

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const ws = useWorkspace();

  // Re-hydrate persisted view state once, client-side (render defaults on the
  // server, reconcile after mount → no hydration mismatch).
  // uiStore.hydrate() applies the persisted data-theme before paint; variantStore
  // then re-asserts the variant's theme. Order matters.
  useEffect(() => {
    uiStore.hydrate();
    variantStore.bootstrap(new URLSearchParams(window.location.search));
    watchlistStore.hydrate();
    timeWindowStore.hydrate();
    alertStore.hydrate();
    langStore.hydrate();
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
      <PanelHost />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* Dockable slide-ins are suppressed while the workspace dock owns them. */}
      {!ws.open && <CoveragePanel />}
      {!ws.open && <MarketsPanel />}
      {!ws.open && <WatchlistPanel />}
      <DockableWorkspace />
      <FeedOverlay />
    </div>
  );
}
