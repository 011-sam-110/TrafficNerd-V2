"use client";
// A docked monitor tile for any catalog source — the "widgetize everything" unit.
// Two shapes share one chrome (the intel-widget .tn-widget vocabulary):
//   • rollup  — a category (catalog `group`): a live summed total + a row per
//     constituent source, each with its own count/freshness and a ⤢ pop-out that
//     adds that single source as its own tile.
//   • source  — a single leaf: a hero count + ▴/▾ delta + a glance sparkline.
// Read-only: every number comes from useSourceLive reading the EXISTING stores;
// nothing here starts a fetch. The map toggle mirrors the source's layer/signal
// on-state so the tile and the map stay in lockstep.

import { getCatalogSource } from "@/lib/sources/catalog";
import { useSourceLive, toggleSourceMap } from "@/lib/sources/live";
import { useCountHistory, deltaOf, trendOf } from "@/lib/widgets/history";
import { constituentIds, rollupCount } from "@/lib/widgets/rollup";
import { addTileToDock } from "@/lib/widgets/dock";
import { sourceKey, type WidgetDescriptor } from "@/lib/widgets/registry";
import { useVariant } from "@/lib/variants/store";
import { useMetrics } from "@/lib/metrics";
import { useSignalCounts } from "@/lib/signals/store";
import type { FreshKind } from "@/lib/sources/freshKind";

const FRESH_LABEL: Record<FreshKind, string> = {
  off: "off",
  unknown: "connecting…",
  live: "live",
  empty: "live · none now",
  lagging: "lagging",
  stale: "stale",
  down: "unavailable",
};

function fmtCount(n: number | null): string {
  return n == null ? "—" : n.toLocaleString();
}

// Freshness pip — the state class lives on the PARENT so the existing
// `.tn-fresh-<state> .tn-fresh-dot` rules colour the inner dot.
function FreshDot({ fresh }: { fresh: FreshKind }) {
  return (
    <span className={`tn-fresh tn-fresh-${fresh}`} role="img" aria-label={FRESH_LABEL[fresh]} title={FRESH_LABEL[fresh]}>
      <span className="tn-fresh-dot" aria-hidden />
    </span>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <span className="tn-src-spark" aria-hidden />;
  const W = 64;
  const H = 18;
  const n = points.length;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${((i / (n - 1)) * W).toFixed(1)} ${(H - p * H).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="tn-src-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LeafWidget({ id }: { id: string }) {
  const source = getCatalogSource(id);
  const live = useSourceLive(id);
  const hist = useCountHistory(id);
  if (!source) {
    return (
      <aside className="tn-widget tn-docked">
        <p className="tn-widget-status">Unknown source “{id}”.</p>
      </aside>
    );
  }
  const delta = deltaOf(hist);
  return (
    <aside className="tn-widget tn-docked" role="region" aria-label={source.label}>
      <header className="tn-widget-head">
        <h3 className="tn-widget-title">
          <span className="tn-src-dot" style={{ background: source.color }} aria-hidden /> {source.label}
        </h3>
        <FreshDot fresh={live.fresh} />
      </header>
      {!live.hasData ? (
        <p className="tn-widget-status">
          Off — enable on the map to monitor it.{" "}
          <button type="button" className="tn-src-enable" onClick={() => toggleSourceMap(id, true)}>
            Enable
          </button>
        </p>
      ) : (
        <div className="tn-src-glance">
          <span className="tn-src-count tn-num">{fmtCount(live.count)}</span>
          {delta !== 0 ? (
            <span className={`tn-src-delta ${delta > 0 ? "up" : "down"}`}>
              {delta > 0 ? "▴" : "▾"}
              {Math.abs(delta)}
            </span>
          ) : null}
          <Sparkline points={trendOf(hist, 16)} color={source.color} />
        </div>
      )}
      <p className="tn-widget-foot">
        <span className="tn-widget-source">{source.attribution}</span>{" "}
        <button
          type="button"
          className="tn-src-mapon"
          role="switch"
          aria-checked={live.mapOn}
          onClick={() => toggleSourceMap(id, !live.mapOn)}
        >
          ◇ {live.mapOn ? "on map" : "off map"}
        </button>
      </p>
    </aside>
  );
}

function RollupRow({ id, activeId }: { id: string; activeId: string }) {
  const source = getCatalogSource(id);
  const live = useSourceLive(id);
  if (!source) return null;
  return (
    <li className="tn-widget-row">
      <span className="tn-src-dot" style={{ background: source.color }} aria-hidden />
      <span className="tn-widget-row-main">
        <span className="tn-widget-row-title">{source.label}</span>
      </span>
      <FreshDot fresh={live.fresh} />
      <span className="tn-widget-metric tn-num">{fmtCount(live.count)}</span>
      <button
        type="button"
        className="tn-src-pop"
        title={`Add ${source.label} as its own widget`}
        aria-label={`Add ${source.label} as its own widget`}
        onClick={() => addTileToDock(activeId, sourceKey(id))}
      >
        ⤢
      </button>
    </li>
  );
}

// Live roll-up total without per-id hooks: core counts come from metrics, signal
// counts from the signals store — summed by the pure rollupCount helper.
function useRollupCount(ids: string[]): number | null {
  const m = useMetrics();
  const sig = useSignalCounts();
  const counts: Record<string, number | undefined> = {};
  for (const id of ids) {
    if (id === "cameras") counts[id] = m.camerasTotal || undefined;
    else if (id === "planes") counts[id] = m.planes || undefined;
    else if (id === "satellites") counts[id] = m.satellites || undefined;
    else if (id === "webcams") counts[id] = m.webcams || undefined;
    else counts[id] = sig[id] ?? undefined;
  }
  return rollupCount(counts, ids);
}

function RollupWidget({ group }: { group: string }) {
  const { activeId } = useVariant();
  const ids = constituentIds(group);
  const total = useRollupCount(ids);
  return (
    <aside className="tn-widget tn-docked" role="region" aria-label={group}>
      <header className="tn-widget-head">
        <h3 className="tn-widget-title">{group}</h3>
        <span className="tn-widget-source">{ids.length} source{ids.length === 1 ? "" : "s"}</span>
      </header>
      <div className="tn-src-glance">
        <span className="tn-src-count tn-num">{fmtCount(total)}</span>
        <span className="tn-src-glance-label">tracked now</span>
      </div>
      <ol className="tn-widget-list">
        {ids.map((id) => (
          <RollupRow key={id} id={id} activeId={activeId} />
        ))}
      </ol>
    </aside>
  );
}

export default function SourceWidget({ widget }: { widget: WidgetDescriptor; docked?: boolean }) {
  return widget.kind === "rollup" ? <RollupWidget group={widget.ref} /> : <LeafWidget id={widget.ref} />;
}
