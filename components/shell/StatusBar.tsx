"use client";
// Thin top status bar — the calm-light reframe of the "ops console" header.
// Wordmark + live global counts (monospaced numerics only) + a single data-health
// badge + the basemap switcher + a ⌘K affordance + the light/dark toggle. It
// floats over the full-bleed globe and recedes; the map stays the hero.

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
import WorkspaceBar from "@/components/shell/WorkspaceBar";
import StageSwitch from "@/components/console/StageSwitch";

type Health = { labelKey: StringKey; tone: "live" | "degraded" | "down" | "connecting" };

function deriveHealth(states: FreshState[]): Health {
  if (states.some((s) => s === "down" || s === "stale")) return { labelKey: "healthDegraded", tone: "degraded" };
  if (states.every((s) => s === "unknown")) return { labelKey: "healthConnecting", tone: "connecting" };
  if (states.some((s) => s === "lagging")) return { labelKey: "healthLagging", tone: "degraded" };
  return { labelKey: "healthLive", tone: "live" };
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tn-metric" title={label}>
      <span className="tn-metric-label">{label}</span>
      <span className="tn-metric-value tn-num">
        {value}
        {sub ? <span className="tn-metric-sub"> / {sub}</span> : null}
      </span>
    </div>
  );
}

export default function StatusBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const m = useMetrics();
  const fresh = useFreshness();
  const view = useMapView();
  const ui = useUI();
  const t = useT();
  const now = useNow(5000); // re-evaluate health a couple of times a minute

  const health = deriveHealth(fresh.map((r) => classifyFreshness(r, now)));

  // "Share" copies a deep link to the current view. Calm confirmation: the label
  // flips to "Copied" for ~1.6s, then restores. The URL itself is kept current by
  // WorldMap (it mirrors the live view), so there's nothing to compute here.
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
      {/* Canonical machine-readable pulse (visually hidden) — kept for the e2e
          smoke test and screen readers; the visible cells below mirror it. */}
      <span data-testid="stat-line" className="tn-sr-only">
        {m.camerasTotal.toLocaleString()} cameras · {m.planes.toLocaleString()} planes ·{" "}
        {m.satellites.toLocaleString()} satellites
      </span>

      <div className="tn-topbar-left">
        <span className="tn-wordmark">
          Traffic<span className="tn-wordmark-accent">Nerd</span>
        </span>
        <span className="tn-tagline">{t("appTagline")}</span>
        <div className="tn-topbar-variant">
          <VariantSwitcher />
          <WorkspaceBar />
        </div>
      </div>

      <div className="tn-topbar-metrics">
        <Metric
          label={t("metricCamerasOnline")}
          value={m.camerasTotal ? m.camerasOnline.toLocaleString() : "—"}
          sub={m.camerasTotal ? m.camerasTotal.toLocaleString() : undefined}
        />
        <span className="tn-dot-sep" aria-hidden />
        <Metric label={t("metricPlanes")} value={m.planes.toLocaleString()} />
        <span className="tn-dot-sep" aria-hidden />
        <Metric label={t("metricSatellites")} value={m.satellites.toLocaleString()} />
        <span className={`tn-health tn-health-${health.tone}`} title="Overall data health">
          <span className="tn-health-dot" aria-hidden />
          {t(health.labelKey)}
        </span>
      </div>

      <div className="tn-topbar-right">
        <StageSwitch />

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
          <button
            type="button"
            className="tn-basemap-btn"
            disabled
            title="Ordnance Survey UK basemap — needs an API key (this build is keyless)"
          >
            OS UK
          </button>
        </div>

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

        <button type="button" className="tn-icon-btn tn-palette-trigger" onClick={onOpenPalette} title="Command palette (⌘K)">
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
