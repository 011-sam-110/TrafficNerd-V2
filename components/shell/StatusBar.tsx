"use client";
// Top status bar — the global chrome that recedes while the map stays the hero.
//
// Layout (left → right):
//   Brand (OpenData)  ·  live-data pulse  ·  [ central board pill ]  ·  ⌘K | profile | settings
//
// The map-view controls (3D/2D + basemap) moved onto the map itself (see
// components/console/MapControls.tsx); language, theme and layout-sharing moved into
// the Settings drawer (opened from the gear). What remains in the bar is identity
// (brand + profile), the single central board switcher, and the ⌘K entry point — a
// far calmer header than the old variant-pill + basemap + utility pile.

import { useState } from "react";
import { useMetrics } from "@/lib/metrics";
import { useFreshness, classifyFreshness, type FreshState } from "@/lib/freshness";
import { useNow } from "@/lib/shell/useNow";
import { useT } from "@/lib/i18n/store";
import type { StringKey } from "@/lib/i18n/catalog";
import PresetPill from "@/components/shell/PresetPill";
import ProfileMenu from "@/components/shell/ProfileMenu";
import SettingsPanel from "@/components/shell/SettingsPanel";

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
 * Single-line live-data pulse: camera online/total, plane count, satellite count, and
 * a health dot on one baseline — glanceable at desktop widths, hidden on mobile.
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
  const t = useT();
  const now = useNow(5000); // re-evaluate health a couple of times per minute
  const health = deriveHealth(fresh.map((r) => classifyFreshness(r, now)));

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="tn-topbar" role="banner">
        {/* Canonical machine-readable pulse — visually hidden, kept for the e2e smoke
            test and screen readers; the visible LivePulse below mirrors it. */}
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

        {/* ── Central board switcher (absolutely centred over the bar) ─────── */}
        <PresetPill />

        {/* ── Entry points + identity ──────────────────────────────────────── */}
        {/* ⌘K · Settings · Profile — the avatar sits at the very edge, with the
            settings gear and ⌘K to its left. */}
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
