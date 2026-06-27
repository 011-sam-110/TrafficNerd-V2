"use client";
// Recency filter for the time-stamped global signals — a compact segmented control
// (1h / 6h / 24h / 7d / All). Drives timeWindowStore; WorldMap applies the pure
// withinWindow() test where it builds the signal feature set. Honest by design:
// "All" (the default) never filters, and untimed or future-dated events are always
// shown — the window only trims events that are too OLD (see lib/shell/timeWindow).

import { TIME_WINDOWS, useTimeWindow, timeWindowStore } from "@/lib/shell/timeWindow";
import { useT } from "@/lib/i18n/store";

export default function TimeWindowControl() {
  const active = useTimeWindow();
  const t = useT();
  return (
    <div className="tn-timewindow">
      <div className="tn-subhead">{t("timeWindowLabel")}</div>
      <div className="tn-timewindow-chips" role="group" aria-label={t("timeWindowLabel")}>
        {TIME_WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            className="tn-timewindow-chip"
            aria-pressed={active === w.key}
            onClick={() => timeWindowStore.set(w.key)}
          >
            {w.key === "all" ? t("timeWindowAll") : w.label}
          </button>
        ))}
      </div>
    </div>
  );
}
