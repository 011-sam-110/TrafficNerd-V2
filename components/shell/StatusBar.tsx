"use client";
// Top status bar — the global chrome that recedes while the map stays the hero.
//
// Layout (left → right):  OpenData wordmark · [ central board pill ] · ⌘K | settings | profile
//
// The live-data pulse (camera/plane/sat counts) was removed from the visible bar for
// calm; the canonical machine-readable count line survives as a visually-hidden span
// (kept for the e2e smoke test + screen readers). Map-view controls live on the map;
// language / theme / share / Telegram live in the Settings drawer.

import { useState } from "react";
import { useMetrics } from "@/lib/metrics";
import PresetPill from "@/components/shell/PresetPill";
import ProfileMenu from "@/components/shell/ProfileMenu";
import SettingsPanel from "@/components/shell/SettingsPanel";

export default function StatusBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const m = useMetrics();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="tn-topbar" role="banner">
        {/* Canonical machine-readable pulse — visually hidden, kept for the e2e smoke
            test and screen readers. */}
        <span data-testid="stat-line" className="tn-sr-only">
          {m.camerasTotal.toLocaleString()} cameras · {m.planes.toLocaleString()} planes ·{" "}
          {m.satellites.toLocaleString()} satellites
        </span>

        {/* ── Brand ────────────────────────────────────────────────────────── */}
        <div className="tn-topbar-left">
          <span className="tn-wordmark">
            Open<span className="tn-wordmark-accent">Data</span>
          </span>
        </div>

        {/* ── Central board switcher (absolutely centred over the bar) ─────── */}
        <PresetPill />

        {/* ── Entry points + identity ──────────────────────────────────────── */}
        {/* ⌘K · Settings · Profile — the avatar sits at the very edge. */}
        <div className="tn-topbar-right">
          <button
            type="button"
            className="tn-icon-btn tn-palette-trigger"
            onClick={onOpenPalette}
            title="Command palette (⌘K)"
          >
            <span className="tn-kbd">⌘K</span>
          </button>

          <button
            type="button"
            className="tn-icon-btn tn-settings-trigger"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
          >
            <span aria-hidden>⚙</span>
          </button>

          <ProfileMenu onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </header>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
