"use client";
// Monitor variants — a compact chip row that configures the WHOLE map in one tap
// (core layers + global signals together). Lives at the top of the layer rail and
// recedes. The active chip is highlighted by matching the live store state against
// each monitor's curated combo (lib/monitors — pure matchMonitor). All it does is
// call applyMonitor(), which drives the existing layer + signal stores.

import { MONITORS, applyMonitor, matchMonitor } from "@/lib/monitors";
import { useLayers } from "@/lib/layers";
import { useSignals } from "@/lib/signals/store";
import { SIGNALS } from "@/lib/signals/registry";
import { useT } from "@/lib/i18n/store";

const SIGNAL_IDS = SIGNALS.map((s) => s.id);

export default function MonitorBar() {
  const layers = useLayers();
  const signals = useSignals();
  const t = useT();
  const active = matchMonitor(layers, signals, SIGNAL_IDS);

  return (
    <div className="tn-monitors">
      <div className="tn-subhead">{t("sectionMonitors")}</div>
      <div className="tn-monitor-chips" role="group" aria-label={t("sectionMonitors")}>
        {MONITORS.map((m) => (
          <button
            key={m.id}
            type="button"
            className="tn-monitor-chip"
            aria-pressed={active === m.id}
            title={m.blurb}
            onClick={() => applyMonitor(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
