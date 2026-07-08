"use client";
// Markets focus view — the milestone the spec centres on: "for markets, it shows
// actual graphs." Reuses the SAME live pipeline as the docked widget
// (useJsonPoll("/api/markets")) for the quote list, and adds a keyless
// /api/markets/chart fetch for the selected instrument's real 1M/6M/1Y history.
// Honest throughout: real OHLC when Yahoo has it, an explicit "live session"
// fallback to the accumulated mkt:<id> series when it doesn't, and an
// "indicative only — not financial advice" disclaimer. Pure series maths live in
// the unit-tested lib/markets/chart.ts; this is the shell.
import { Fragment, useEffect, useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import type { MarketsPayload, MarketRow, MarketSection } from "@/lib/markets";
import { useJsonPoll } from "@/lib/console/widgets/useJsonPoll";
import { recordSeries, seriesSamples } from "@/lib/series";
import { Chart, type ChartPoint } from "@/components/Chart";
import { shellLayoutStore } from "@/lib/console/store";
import { candlesToPoints, hiLo, periodChange, RANGES, type Candle, type Range } from "@/lib/markets/chart";

const EMPTY: MarketsPayload = { generatedAt: 0, sections: [] };
const RANGE_LABEL: Record<Range, string> = { "1mo": "1M", "6mo": "6M", "1y": "1Y" };
type TableSortKey = "name" | "changePct" | "value";

/** Adaptive-precision number formatting for prices/levels (large → 2dp, tiny → 6dp). */
function fmtNum(n: number): string {
  const abs = Math.abs(n);
  const d = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

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

  const selRow = useMemo(() => allRows.find((r) => r.id === selId) ?? null, [allRows, selId]);
  const selSym = selRow ? (selRow.symbol ?? selRow.id) : null;

  // Primary historical chart: keyless Yahoo v8 OHLC for the selected instrument +
  // range. Dormant-safe — the route never 5xxes, and a <2-candle result (dormant /
  // no history / crypto-FX symbol Yahoo doesn't chart) falls back to the live series.
  const [range, setRange] = useState<Range>("6mo");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  useEffect(() => {
    if (!selSym) { setCandles([]); return; }
    let alive = true;
    setChartLoading(true);
    fetch(`/api/markets/chart?symbol=${encodeURIComponent(selSym)}&range=${range}`)
      .then((r) => r.json())
      .then((d: { candles?: Candle[] }) => { if (alive) setCandles(Array.isArray(d.candles) ? d.candles : []); })
      .catch(() => { if (alive) setCandles([]); })
      .finally(() => { if (alive) setChartLoading(false); });
    return () => { alive = false; };
  }, [selSym, range]);

  const hasHistory = candles.length >= 2;
  const chg = useMemo(() => periodChange(candles), [candles]);
  const range52 = useMemo(() => hiLo(candles), [candles]);
  // Honest fallback: chart the accumulated live mkt:<id> series when there's no
  // real history. Read in render (folds in the latest recorded sample via tick).
  const livePoints: ChartPoint[] = useMemo(
    () => (selId ? seriesSamples(`mkt:${selId}`).map((s) => ({ x: s.t, y: s.n })) : []),
    [selId, data.generatedAt],
  );
  const chartPoints = hasHistory ? candlesToPoints(candles) : livePoints;
  const chartUp = hasHistory
    ? chg.abs >= 0
    : selRow?.changePct == null ? null : selRow.changePct >= 0;

  // Sortable instrument table across every section (with its section attribution).
  const [sortKey, setSortKey] = useState<TableSortKey>("changePct");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [openTid, setOpenTid] = useState<string | null>(null);
  const tableRows = useMemo(() => {
    const arr = railSections.flatMap((s) => s.rows.map((r) => ({ r, secLabel: s.label, secSrc: s.source })));
    return arr.sort((a, b) => {
      let d: number;
      if (sortKey === "name") d = (a.r.symbol ?? a.r.name).localeCompare(b.r.symbol ?? b.r.name);
      else if (sortKey === "changePct") d = (a.r.changePct ?? -Infinity) - (b.r.changePct ?? -Infinity);
      else d = (a.r.num ?? -Infinity) - (b.r.num ?? -Infinity);
      return d * sortDir;
    });
  }, [railSections, sortKey, sortDir]);
  const toggleSort = (k: TableSortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(k === "name" ? 1 : -1); }
  };
  const sortMark = (k: TableSortKey) => (sortKey === k ? (sortDir === -1 ? " ↓" : " ↑") : "");
  const onTableRow = (id: string) => { selectRow(id); setOpenTid((o) => (o === id ? null : id)); };

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
            {selRow ? (
              <div className="tn-mk-panel">
                <div className="tn-mk-panel-head">
                  <div>
                    <div className="tn-mk-panel-title">{selRow.name}{selRow.symbol ? ` · ${selRow.symbol}` : ""}</div>
                    <div className="tn-mk-panel-sub">{selRow.value}{selRow.sub ? ` · ${selRow.sub}` : ""}</div>
                  </div>
                  <div className="tn-mk-tabs" role="tablist" aria-label="Chart range">
                    {RANGES.map((rg) => (
                      <button key={rg} role="tab" aria-selected={range === rg} className={`tn-mk-tab ${range === rg ? "active" : ""}`} onClick={() => setRange(rg)}>
                        {RANGE_LABEL[rg]}
                      </button>
                    ))}
                  </div>
                </div>

                {chartPoints.length >= 2 ? (
                  <>
                    <Chart points={chartPoints} height={220} zeroBaseline={false} up={chartUp} markers />
                    {hasHistory ? (
                      <>
                        <div className="tn-mk-metrics">
                          <span className={`tn-mk-metric ${chg.abs >= 0 ? "up" : "down"}`}>
                            <span className="tn-mk-metric-label">Change ({RANGE_LABEL[range]})</span>{" "}
                            <b>{chg.abs >= 0 ? "+" : ""}{fmtNum(chg.abs)} ({chg.pct >= 0 ? "+" : ""}{chg.pct.toFixed(2)}%)</b>
                          </span>
                          {range52 && (
                            <span className="tn-mk-metric">
                              <span className="tn-mk-metric-label">{range === "1y" ? "52-wk range" : "Range"}</span>{" "}
                              <b>{fmtNum(range52.lo)} – {fmtNum(range52.hi)}</b>
                            </span>
                          )}
                          <span className="tn-mk-metric"><span className="tn-mk-metric-label">{candles.length} bars · Yahoo v8, delayed</span></span>
                        </div>
                      </>
                    ) : (
                      <div className="tn-mk-chart-note">Live session (accumulating) — historical unavailable for this symbol.</div>
                    )}
                  </>
                ) : (
                  <div className="tn-mk-chart-empty">{chartLoading ? "Loading chart…" : "No history yet — accumulating a live session series."}</div>
                )}
              </div>
            ) : (
              <p className="tn-w-empty">Select an instrument to see its chart.</p>
            )}

            <table className="tn-mk-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("name")}>Instrument{sortMark("name")}</th>
                  <th className="sortable num" onClick={() => toggleSort("changePct")}>Change{sortMark("changePct")}</th>
                  <th className="sortable num" onClick={() => toggleSort("value")}>Value{sortMark("value")}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ r, secLabel, secSrc }) => {
                  const isOpen = openTid === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className={`tn-mk-trow ${selId === r.id ? "is-sel" : ""}`} onClick={() => onTableRow(r.id)}>
                        <td><span className="tn-mk-row-sym">{r.symbol ?? r.name}</span> <span className="tn-mk-row-name">{r.name}</span></td>
                        <td className="num">
                          {r.changePct != null
                            ? <span className={`tn-mk-chg ${r.changePct >= 0 ? "up" : "down"}`}>{r.changePct >= 0 ? "+" : ""}{r.changePct}%</span>
                            : <span className="tn-mk-row-name">—</span>}
                        </td>
                        <td className="num">{r.value}</td>
                      </tr>
                      {isOpen && (
                        <tr className="tn-mk-drill">
                          <td colSpan={3}>
                            <dl>
                              <dt>Value</dt><dd>{r.value}</dd>
                              {r.changePct != null && (<><dt>Change</dt><dd className={`tn-mk-chg ${r.changePct >= 0 ? "up" : "down"}`}>{r.changePct >= 0 ? "+" : ""}{r.changePct}%</dd></>)}
                              {r.sub && (<><dt>Detail</dt><dd>{r.sub}</dd></>)}
                              <dt>Class</dt><dd>{secLabel}</dd>
                              <dt>Source</dt><dd>{secSrc}</dd>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </main>
        </div>
      )}
    </div>
  );
}
