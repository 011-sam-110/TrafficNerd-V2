"use client";
// Cameras focus view — the traffic-camera console. The docked widget only sees
// map-loaded cameras (loadedCamerasStore); this detail fetches the full enriched
// /api/cameras list via useCameras(), then renders deep: a coverage-honesty masthead
// with a count sparkline, a per-operator coverage bar, operator/region filters, a
// region map, still + click-to-activate live camera walls (HLS concurrency-capped),
// a sortable table with a per-camera CameraDetail dossier, and an attribution +
// export footer. All snapshots go strictly through /api/proxy?id= (still) and
// /api/hls?id= (live) via CameraImage / CameraVideo / CameraDetail — never a raw
// upstream URL (SSRF). Coverage + concurrency maths live in unit-tested lib/cameras/.
import { useEffect, useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { useCameras } from "@/lib/cameras/useCameras";
import { coverage } from "@/lib/cameras/coverage";
import { recordSeries, seriesSamples } from "@/lib/series";
import { deltaOf } from "@/lib/widgets/history";
import { Chart, type ChartPoint } from "@/components/Chart";

type SortKey = "name" | "operator" | "region";

export default function CamerasDetail(_props: WidgetDetailProps) {
  const { cameras, status, updatedAt } = useCameras();
  const cov = useMemo(() => coverage(cameras), [cameras]);
  const total = cov.total;

  // Filter / sort / dossier state — consumed by the panels + table added in the
  // later tasks. Declared here as the skeleton (no noUnusedLocals) so the component
  // grows in place.
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("operator");
  const [dir, setDir] = useState<1 | -1>(1);

  // Count sparkline: only stamp the series ONCE REAL DATA HAS ARRIVED (the W4 review
  // fix). The initial feed is empty and its updatedAt is null; even after a poll,
  // recording a count=0 from an empty list would persist a spurious zero. `stamp` is
  // null until cameras exist, so the `if (stamp)` guards below never fire on empties.
  const stamp = cameras.length > 0 ? updatedAt : null;
  useEffect(() => {
    if (stamp) recordSeries("cam:count", total, stamp);
  }, [stamp, total]);

  // Read the persisted series AND fold in the CURRENT poll's live count — recordSeries
  // only writes in a post-commit effect and lib/series has no React subscription, so
  // without folding it in the delta/sparkline would trail the count beside them by one
  // poll (exactly as signals.detail.tsx / aviation.detail.tsx do).
  const samples = useMemo(() => {
    const base = seriesSamples("cam:count");
    const last = base[base.length - 1];
    if (stamp && (!last || last.t !== stamp || last.n !== total)) {
      return [...base, { t: stamp, n: total }];
    }
    return base;
  }, [stamp, total]);
  const spark: ChartPoint[] = useMemo(() => samples.map((s) => ({ x: s.t, y: s.n })), [samples]);
  const delta = useMemo(() => deltaOf(samples), [samples]);

  const freshAge = updatedAt ? `${Math.max(0, Math.round((Date.now() - updatedAt) / 60000))}m ago` : "—";

  return (
    <div className="tn-cm">
      <header className="tn-cm-head">
        <div className="tn-cm-title">Camera network</div>
        <div className="tn-cm-stat">
          <b>{total}</b> cameras · {cov.live} live · {cov.still} still · {cov.offline} offline · updated {freshAge}
          {delta !== 0 && (
            <span className={`tn-cm-delta ${delta > 0 ? "up" : "down"}`}> {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</span>
          )}
        </div>
        {spark.length >= 2 && <div className="tn-cm-spark"><Chart points={spark} height={40} up={null} /></div>}
      </header>

      {status === "loading" && cameras.length === 0 && <p className="tn-w-empty">Loading cameras…</p>}
      {status === "error" && cameras.length === 0 && <p className="tn-w-empty">Could not load cameras.</p>}
      {status === "idle" && cameras.length === 0 && <p className="tn-w-empty">No cameras loaded.</p>}

      <footer className="tn-cm-foot">
        <span className="tn-cm-attr">Traffic cameras · see each camera for its licence.</span>
      </footer>
    </div>
  );
}
