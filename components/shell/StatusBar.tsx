"use client";
// Top status bar — the global chrome that recedes while the map stays the hero.
//
// Layout (left → right):
//   Brand + variant  ·  live-data pulse (fills remaining width)  ·  view controls | utilities
//
// View controls:  StageSwitch (3D / 2D / clock)  +  Basemap segmented (Light / Sat / Topo)
// Utilities:      LangSwitcher  +  Share  +  ⌘K  +  theme toggle
//
// The disabled OS UK basemap button is removed from the DOM — it has no public
// keyless tile source, so showing it as a dead button is misleading.
// The tagline is removed from the DOM — decorative copy that wastes header space.
// VariantSwitcher is kept and moved directly into the brand cluster: it drives
// layers, signals, and panels across the whole console (not orphaned).

import { useEffect, useRef, useState } from "react";
import { useMetrics } from "@/lib/metrics";
import { useFreshness, classifyFreshness, type FreshState } from "@/lib/freshness";
import { useMapView, mapViewStore } from "@/lib/mapView";
import { BASEMAPS, type BasemapKey } from "@/lib/basemaps";
import { uiStore, useUI } from "@/lib/shell/ui";
import { useNow } from "@/lib/shell/useNow";
import { copyShareLink } from "@/lib/share/deepLink";
import { useT } from "@/lib/i18n/store";
import type { StringKey } from "@/lib/i18n/catalog";
import LangSwitcher from "@/components/shell/LangSwitcher";
import VariantSwitcher from "@/components/shell/VariantSwitcher";
import StageSwitch from "@/components/console/StageSwitch";

type Health = { labelKey: StringKey; tone: "live" | "degraded" | "down" | "connecting" };

function deriveHealth(states: FreshState[]): Health {
  if (states.some((s) => s === "down" || s === "stale")) return { labelKey: "healthDegraded", tone: "degraded" };
  if (states.every((s) => s === "unknown")) return { labelKey: "healthConnecting", tone: "connecting" };
  if (states.some((s) => s === "lagging")) return { labelKey: "healthLagging", tone: "degraded" };
  return { labelKey: "healthLive", tone: "live" };
}

/** Compact thousands formatter: 13456 → "13.5k", small numbers pass through unchanged. */
function fmtCount(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

/**
 * Single-line live-data pulse, replacing the three tall two-row Metric blocks.
 * Renders camera online/total, plane count, satellite count, and a health dot
 * all on one baseline — glanceable at desktop widths, hidden on mobile where
 * screen space is too narrow.
 */
function LivePulse({
  camerasOnline,
  camerasTotal,
  planes,
  satellites,
  health,
  t,
}: {
  camerasOnline: number;
  camerasTotal: number;
  planes: number;
  satellites: number;
  health: Health;
  t: (k: StringKey) => string;
}) {
  return (
    <div className="tn-top-pulse" aria-label="Live data counts">
      <span className="tn-top-pulse-item tn-num" title={t("metricCamerasOnline")}>
        {camerasTotal ? `${fmtCount(camerasOnline)} / ${fmtCount(camerasTotal)}` : "—"}
        <span className="tn-top-pulse-lbl">cam</span>
      </span>
      <span className="tn-top-pulse-dot" aria-hidden />
      <span className="tn-top-pulse-item tn-num" title={t("metricPlanes")}>
        {fmtCount(planes)}
        <span className="tn-top-pulse-lbl">{t("metricPlanes")}</span>
      </span>
      <span className="tn-top-pulse-dot" aria-hidden />
      <span className="tn-top-pulse-item tn-num" title={t("metricSatellites")}>
        {fmtCount(satellites)}
        <span className="tn-top-pulse-lbl">sat</span>
      </span>
      <span
        className={`tn-top-health-badge tn-top-health-${health.tone}`}
        title={t(health.labelKey)}
        aria-label={t(health.labelKey)}
        role="img"
      />
    </div>
  );
}

export default function StatusBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const m = useMetrics();
  const fresh = useFreshness();
  const view = useMapView();
  const ui = useUI();
  const t = useT();
  const now = useNow(5000); // re-evaluate health a couple of times per minute

  const health = deriveHealth(fresh.map((r) => classifyFreshness(r, now)));

  // "Share" copies a deep link to the current view. The label flips to "Copied"
  // for ~1.6 s then restores.
  const [shared, setShared] = useState(false);
  const sharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (sharedTimer.current) clearTimeout(sharedTimer.current);
  }, []);
  const onShare = async () => {
    const ok = await copyShareLink();
    if (!ok) return;
    setShared(true);
    if (sharedTimer.current) clearTimeout(sharedTimer.current);
    sharedTimer.current = setTimeout(() => setShared(false), 1600);
  };

  return (
    <header className="tn-topbar" role="banner">
      {/* Canonical machine-readable pulse — visually hidden, kept for the e2e
          smoke test and screen readers; the visible LivePulse below mirrors it. */}
      <span data-testid="stat-line" className="tn-sr-only">
        {m.camerasTotal.toLocaleString()} cameras · {m.planes.toLocaleString()} planes ·{" "}
        {m.satellites.toLocaleString()} satellites
      </span>

      {/* ── Brand + variant ─────────────────────────────────────────────── */}
      <div className="tn-topbar-left">
        <span className="tn-wordmark">
          Traffic<span className="tn-wordmark-accent">Nerd</span>
        </span>
        <VariantSwitcher />
      </div>

      {/* ── Live data pulse (grows to fill remaining space) ─────────────── */}
      <div className="tn-topbar-metrics">
        <LivePulse
          camerasOnline={m.camerasOnline}
          camerasTotal={m.camerasTotal}
          planes={m.planes}
          satellites={m.satellites}
          health={health}
          t={t}
        />
      </div>

      {/* ── View controls · utility actions ──────────────────────────────── */}
      <div className="tn-topbar-right">

        {/* Primary view controls ---------------------------------------- */}
        <StageSwitch />

        {/* Basemap segmented control — 3 active options (OS UK removed: needs
            an API key and has no public keyless tile source for this build). */}
        <div className="tn-basemap" role="group" aria-label="Basemap">
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className="tn-basemap-btn"
              aria-pressed={view.basemap === k}
              onClick={() => mapViewStore.setBasemap(k)}
            >
              {BASEMAPS[k].label}
            </button>
          ))}
        </div>

        {/* Hairline divider: view controls / utility actions */}
        <span className="tn-top-sep" aria-hidden />

        {/* Utility actions ---------------------------------------------- */}
        <LangSwitcher />

        <button
          type="button"
          className={`tn-icon-btn tn-share-btn${shared ? " is-copied" : ""}`}
          onClick={onShare}
          title="Copy a link to this exact view"
          aria-live="polite"
        >
          {shared ? "✓ Copied" : "Share"}
        </button>

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
          className="tn-icon-btn"
          onClick={() => uiStore.toggleTheme()}
          aria-label="Toggle light/dark"
          title="Toggle light / dark"
        >
          {ui.theme === "light" ? "☾" : "☀"}
        </button>
      </div>
    </header>
  );
}
