"use client";
// The generic Phase-1 monitor widget. ONE shell renders both a leaf source and a
// category roll-up. Header: colour dot + title + live count + ▴/▾ delta + freshness
// dot/age. Body (glance): hero count + a tiny CSS sparkline from count history.
// Footer: attribution + the mirrored ◇ on-map toggle. Reads existing stores only.

import { getCatalogSource } from "@/lib/sources/catalog";
import { useSourceLive, toggleSourceMap, type SourceLive } from "@/lib/sources/live";
import { useCountHistory, deltaOf, trendOf } from "@/lib/widgets/history";
import { constituentIds, rollupCount, rollupFresh } from "@/lib/widgets/rollup";
import { placementStore } from "@/lib/widgets/placement";
import { sourceKey, type WidgetDescriptor } from "@/lib/widgets/registry";
import { useSignalCounts } from "@/lib/signals/store";
import type { FreshKind } from "@/lib/sources/freshKind";

const FRESH_LABEL: Record<FreshKind, string> = {
  off: "off", unknown: "connecting…", live: "live", empty: "live · none now",
  lagging: "lagging", stale: "stale", down: "unavailable",
};

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 48, h = 14;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - p * h).toFixed(1)}`).join(" ");
  return (
    <svg className="tn-w-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function LeafBody({ id, live }: { id: string; live: SourceLive }) {
  const hist = useCountHistory(id);
  const delta = deltaOf(hist);
  if (!live.hasData) {
    return (
      <div className="tn-w-glance tn-w-off">
        <span className="tn-w-offnote">Off — enable on map to monitor</span>
        <button type="button" className="tn-w-enable" onClick={() => toggleSourceMap(id, true)}>Enable</button>
      </div>
    );
  }
  return (
    <div className="tn-w-glance">
      <span className="tn-w-count tn-num">{live.count == null ? "—" : live.count.toLocaleString()}</span>
      {delta !== 0 ? <span className={`tn-w-delta ${delta > 0 ? "up" : "down"}`}>{delta > 0 ? "▴" : "▾"}{Math.abs(delta)}</span> : null}
      <Sparkline points={trendOf(hist, 16)} />
    </div>
  );
}

function RollupBody({ group }: { group: string }) {
  const ids = constituentIds(group);
  const sigCounts = useSignalCounts();
  // NB: core counts aren't keyed in sigCounts; a roll-up that mixes core+signal shows
  // the signal portion here and the per-source rows below carry their own live count.
  const total = rollupCount(sigCounts as Record<string, number | undefined>, ids);
  return (
    <div className="tn-w-rollup">
      <div className="tn-w-glance">
        <span className="tn-w-count tn-num">{total == null ? "—" : total.toLocaleString()}</span>
        <span className="tn-w-sub">{ids.length} sources</span>
      </div>
      <ul className="tn-w-rows">
        {ids.map((id) => <RollupRow key={id} id={id} />)}
      </ul>
    </div>
  );
}

function RollupRow({ id }: { id: string }) {
  const s = getCatalogSource(id);
  const live = useSourceLive(id);
  if (!s) return null;
  return (
    <li className="tn-w-row">
      <span className="tn-w-rowdot" style={{ background: s.color }} />
      <span className="tn-w-rowname">{s.label}</span>
      <span className={`tn-fresh-dot tn-fresh-${live.fresh}`} aria-hidden />
      <span className="tn-w-rowcount tn-num">{live.count == null ? "—" : live.count.toLocaleString()}</span>
      <button
        type="button"
        className="tn-w-popout"
        title={`Pop out ${s.label} as its own widget`}
        onClick={() => placementStore.add(sourceKey(id))}
      >⤢</button>
    </li>
  );
}

export default function SourceWidget({ widget }: { widget: WidgetDescriptor }) {
  const isRollup = widget.kind === "rollup";
  const id = widget.ref;
  const source = isRollup ? undefined : getCatalogSource(id);
  // Header freshness: a leaf's own state, or a roll-up's worst-of (computed in body's rows;
  // here we show a neutral dot for roll-ups to avoid a second pass).
  const live = useSourceLive(isRollup ? "" : id);
  const fresh: FreshKind = isRollup ? rollupFresh([]) : live.fresh;
  return (
    <section className="tn-widget" aria-label={widget.title}>
      <header className="tn-widget-head">
        <span className="tn-widget-dot" style={{ background: source?.color ?? "var(--tn-accent)" }} />
        <span className="tn-widget-title">{widget.title}</span>
        <span className="tn-widget-spacer" />
        <span className={`tn-fresh-dot tn-fresh-${fresh}`} title={FRESH_LABEL[fresh]} aria-label={FRESH_LABEL[fresh]} />
        <button
          type="button"
          className="tn-widget-x"
          title="Remove widget"
          aria-label={`Remove ${widget.title}`}
          onClick={() => placementStore.remove(widget.key)}
        >×</button>
      </header>
      <div className="tn-widget-body">
        {isRollup ? <RollupBody group={id} /> : <LeafBody id={id} live={live} />}
      </div>
      <footer className="tn-widget-foot">
        <span className="tn-widget-attr">{source?.attribution ?? `${constituentIds(id).length} sources`}</span>
        {!isRollup && source ? (
          <button
            type="button"
            className="tn-widget-mapon"
            role="switch"
            aria-checked={live.mapOn}
            onClick={() => toggleSourceMap(id, !live.mapOn)}
          >◇ {live.mapOn ? "on map" : "off map"}</button>
        ) : null}
      </footer>
    </section>
  );
}
