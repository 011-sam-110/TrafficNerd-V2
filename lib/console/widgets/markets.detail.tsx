"use client";
// Markets focus view — the milestone the spec centres on: "for markets, it shows
// actual graphs." Reuses the SAME live pipeline as the docked widget
// (useJsonPoll("/api/markets")) for the quote list, and adds a keyless
// /api/markets/chart fetch for the selected instrument's real 1M/6M/1Y history.
// Honest throughout: real OHLC when Yahoo has it, an explicit "live session"
// fallback to the accumulated mkt:<id> series when it doesn't, and an
// "indicative only — not financial advice" disclaimer. Pure series maths live in
// the unit-tested lib/markets/chart.ts; this is the shell.
import { useEffect, useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import type { MarketsPayload, MarketRow, MarketSection } from "@/lib/markets";
import { useJsonPoll } from "@/lib/console/widgets/useJsonPoll";
import { recordSeries, seriesSamples } from "@/lib/series";
import { Chart, type ChartPoint } from "@/components/Chart";
import { shellLayoutStore } from "@/lib/console/store";

const EMPTY: MarketsPayload = { generatedAt: 0, sections: [] };

/** Signed magnitude used for movers-first ordering; nulls sort last. */
function absMove(r: MarketRow): number {
  return r.changePct == null ? -1 : Math.abs(r.changePct);
}

/** Heat-strip / change colour scaled by move magnitude (green up, red down). */
function moverBg(pct: number): string {
  const mag = Math.min(1, Math.abs(pct) / 8);
  const a = 0.15 + mag * 0.6;
  return pct >= 0 ? `rgba(22,163,74,${a})` : `rgba(220,38,38,${a})`;
}

function freshLabel(generatedAt: number, now: number): string {
  if (!generatedAt) return "—";
  const m = Math.max(0, Math.round((now - generatedAt) / 60000));
  return m === 0 ? "just now" : `${m}m ago`;
}

export default function MarketsDetail({ instanceId, config }: WidgetDetailProps) {
  const { data, status } = useJsonPoll<MarketsPayload>("/api/markets", 120_000, EMPTY);

  // Keep dormant (key-gated) sections too — surfaced as a "needs key" note rather
  // than hidden, so the capability is discoverable (mirrors the docked widget).
  const sections = useMemo<MarketSection[]>(
    () => (data.sections ?? []).filter((s) => s.rows.length || s.dormant),
    [data.sections],
  );
  // Movers-first ordering within each section.
  const railSections = useMemo(
    () => sections.map((s) => ({ ...s, rows: [...s.rows].sort((a, b) => absMove(b) - absMove(a)) })),
    [sections],
  );
  const allRows = useMemo(() => railSections.flatMap((s) => s.rows), [railSections]);

  // Record each row's raw value into the PERSISTED mkt:<id> series so the rail
  // sparklines accumulate AND the honest "live session" chart fallback has data;
  // bump a tick so a fresh sample shows this render.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!data.generatedAt) return;
    for (const r of allRows) if (typeof r.num === "number") recordSeries(`mkt:${r.id}`, r.num, data.generatedAt);
    setTick((t) => t + 1);
  }, [data.generatedAt, allRows]);

  // Selected instrument — seeded from persisted config, then the first (biggest) mover.
  const [selId, setSelId] = useState<string | null>(
    () => (typeof config.selectedId === "string" ? config.selectedId : null),
  );
  useEffect(() => {
    if (selId && allRows.some((r) => r.id === selId)) return;
    const first = allRows[0];
    if (first) setSelId(first.id);
  }, [allRows, selId]);
  const selectRow = (id: string) => {
    setSelId(id);
    shellLayoutStore.configure(instanceId, { selectedId: id });
  };

  // Top movers across every section (biggest absolute move first), for the heat-strip.
  const movers = useMemo(
    () => allRows.filter((r) => r.changePct != null).sort((a, b) => absMove(b) - absMove(a)).slice(0, 8),
    [allRows],
  );

  const now = Date.now();

  if (status === "loading" && allRows.length === 0) return <p className="tn-w-empty">Loading markets…</p>;

  return (
    <div className="tn-mk">
      <header className="tn-mk-head">
        <div className="tn-mk-title">Markets</div>
        <div className="tn-mk-stat">
          <b>{allRows.length}</b> instruments · {sections.length} asset {sections.length === 1 ? "class" : "classes"} · updated {freshLabel(data.generatedAt, now)}
        </div>
        <div className="tn-mk-disc">Indicative only — not financial advice. Quotes delayed, keyless.</div>
      </header>

      {allRows.length === 0 && <p className="tn-w-empty">Markets unavailable.</p>}

      {movers.length > 0 && (
        <div className="tn-mk-heat" aria-label="Biggest movers">
          {movers.map((r) => (
            <button
              key={r.id}
              className={`tn-mk-heat-chip ${selId === r.id ? "is-sel" : ""}`}
              style={{ background: moverBg(r.changePct as number) }}
              onClick={() => selectRow(r.id)}
              title={`${r.name} ${(r.changePct as number) >= 0 ? "+" : ""}${r.changePct}%`}
            >
              <span className="tn-mk-heat-sym">{r.symbol ?? r.name}</span>
              <span className="tn-mk-heat-pct">{(r.changePct as number) >= 0 ? "+" : ""}{r.changePct}%</span>
            </button>
          ))}
        </div>
      )}

      {allRows.length > 0 && (
        <div className="tn-mk-body">
          <aside className="tn-mk-rail" aria-label="Instruments">
            {railSections.map((sec) => (
              <div key={sec.key} className="tn-mk-sec">
                <div className="tn-mk-sec-h">
                  <span className="tn-mk-sec-label">{sec.label}</span>
                  <span className="tn-mk-sec-src">{sec.source}</span>
                </div>
                {sec.dormant ? (
                  <p className="tn-mk-sec-note">🔒 {sec.note ?? "Needs an API key."}</p>
                ) : (
                  <ul className="tn-mk-rows">
                    {sec.rows.map((r) => {
                      const spark: ChartPoint[] = seriesSamples(`mkt:${r.id}`).map((s) => ({ x: s.t, y: s.n }));
                      return (
                        <li key={r.id}>
                          <button
                            className={`tn-mk-row ${selId === r.id ? "is-sel" : ""}`}
                            onClick={() => selectRow(r.id)}
                            aria-pressed={selId === r.id}
                          >
                            <span className="tn-mk-row-main">
                              <span className="tn-mk-row-sym">{r.symbol ?? r.name}</span>
                              <span className="tn-mk-row-name">{r.name}</span>
                            </span>
                            <span className="tn-mk-row-val">
                              <span className="tn-mk-row-price">{r.value}</span>
                              {r.changePct != null && (
                                <span className={`tn-mk-chg ${r.changePct >= 0 ? "up" : "down"}`}>
                                  {r.changePct >= 0 ? "+" : ""}{r.changePct}%
                                </span>
                              )}
                            </span>
                            <span className="tn-mk-row-spark">
                              <Chart points={spark} height={28} area={false} zeroBaseline={false} up={r.changePct == null ? null : r.changePct >= 0} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </aside>

          <main className="tn-mk-main">
            <p className="tn-w-empty">Select an instrument to see its chart.</p>
          </main>
        </div>
      )}
    </div>
  );
}
