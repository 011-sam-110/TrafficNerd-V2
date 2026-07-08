"use client";
// Aviation focus view — the airspace console. Reuses the SAME live pipeline as the
// docked widget (usePlanes → { objects, trails }) but renders deep: an ops-summary
// masthead with a count sparkline, an emergency-squawk banner, region + altitude
// filters, a region map and altitude histogram, a sortable uncapped flight table
// with a per-flight PlaneDetail dossier, and an attribution footer with export.
// All aviation maths lives in the unit-tested lib/planes/ops.ts; this is a shell.
import { useEffect, useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { usePlanes } from "@/lib/planes/usePlanes";
import { opsSummary, type AltBand, type FlightSortKey } from "@/lib/planes/ops";
import { recordSeries, seriesSamples } from "@/lib/series";
import { deltaOf } from "@/lib/widgets/history";
import { Chart, type ChartPoint } from "@/components/Chart";

const MS_TO_KT = 1.94384;
const EMERGENCY_REASON: Record<string, string> = { "7500": "hijack", "7600": "radio failure", "7700": "emergency" };

export default function AviationDetail(_props: WidgetDetailProps) {
  const layer = usePlanes();
  const objects = layer.objects;

  const summary = useMemo(() => opsSummary(objects), [objects]);
  const total = summary.total;

  // Filter / sort / dossier state — consumed by the panels and table added in the
  // later tasks. Declared here as the skeleton so the component grows in place.
  const [region, setRegion] = useState<string | null>(null);
  const [band, setBand] = useState<AltBand | null>(null);
  const [sortKey, setSortKey] = useState<FlightSortKey>("altitude");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [openId, setOpenId] = useState<string | null>(null);

  // usePlanes hands back a fresh objects array every poll (even when unchanged), so
  // its reference change is our per-poll clock — the stable timestamp the count
  // sparkline needs (usePlanes exposes no updatedAt of its own).
  const [updatedAt, setUpdatedAt] = useState(0);
  useEffect(() => { setUpdatedAt(Date.now()); }, [objects]);

  useEffect(() => {
    if (updatedAt) recordSeries("av:count", total, updatedAt);
  }, [updatedAt, total]);

  // Read the persisted series AND fold in the CURRENT poll's live count. recordSeries
  // only writes in a post-commit effect and lib/series has no React subscription, so
  // without folding it in here the delta/sparkline would trail the count beside them
  // by one poll (exactly as signals.detail.tsx does).
  const samples = useMemo(() => {
    const base = seriesSamples("av:count");
    const last = base[base.length - 1];
    if (updatedAt && (!last || last.t !== updatedAt || last.n !== total)) {
      return [...base, { t: updatedAt, n: total }];
    }
    return base;
  }, [updatedAt, total]);
  const spark: ChartPoint[] = useMemo(() => samples.map((s) => ({ x: s.t, y: s.n })), [samples]);
  const delta = useMemo(() => deltaOf(samples), [samples]);

  const emergencies = useMemo(
    () => objects.filter((o) => {
      const sq = o.meta?.squawk;
      return typeof sq === "string" && sq in EMERGENCY_REASON;
    }),
    [objects],
  );

  return (
    <div className="tn-av">
      <header className="tn-av-head">
        <div className="tn-av-title">Airspace</div>
        <div className="tn-av-stat">
          <b>{total}</b> live · {summary.airborne} airborne · {summary.ground} ground · max{" "}
          {summary.maxAltKm.toFixed(1)} km · {(summary.maxSpeedMs * MS_TO_KT).toFixed(0)} kt
          {delta !== 0 && (
            <span className={`tn-av-delta ${delta > 0 ? "up" : "down"}`}> {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</span>
          )}
        </div>
        {spark.length >= 2 && <div className="tn-av-spark"><Chart points={spark} height={40} up={null} /></div>}
        {summary.byCategory.length > 0 && (
          <div className="tn-av-ops">
            {summary.byCategory.map((c) => (
              <span key={c.category} className="tn-av-chip">{c.label} · {c.count}</span>
            ))}
          </div>
        )}
      </header>

      {emergencies.length > 0 && (
        <div className="tn-av-emg-list">
          {emergencies.map((o) => {
            const code = o.meta?.squawk as string;
            return (
              <div key={o.id} className="tn-av-emg">
                ⚠ {o.label} squawking {code} — {EMERGENCY_REASON[code]}
              </div>
            );
          })}
        </div>
      )}

      {objects.length === 0 && <p className="tn-w-empty">No aircraft in range right now.</p>}

      <footer className="tn-av-foot">
        <span className="tn-av-attr">Aircraft: adsb.lol · enrichment: adsbdb · 3 fixed regions (London / California / S.Carolina)</span>
      </footer>
    </div>
  );
}
