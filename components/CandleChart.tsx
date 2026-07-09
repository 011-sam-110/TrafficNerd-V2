"use client";
// Dependency-free SVG candlestick chart — the Markets focus view's primary chart.
// Deliberately NOT a charting library (keeps the app's zero-dep, calm identity):
// candles + wicks, index-spaced (no weekend gaps), with optional index-aligned
// overlays (moving averages, Bollinger band, benchmark shape), a volume-by-price
// profile, data-driven anomaly anchors, and a hover crosshair that reports the
// candle under the cursor so the caller can render an OHLC read-out.
//
// All maths (SMA / Bollinger / RSI / volume profile / anomalies / rescale) live in
// the unit-tested lib/markets/indicators.ts; this file is pure projection to SVG.
import { useEffect, useMemo, useRef, useState } from "react";
import { extent, linear } from "@/lib/chart/scale";
import type { Candle } from "@/lib/markets/chart";
import type { VolBin, Anomaly } from "@/lib/markets/indicators";

/** An index-aligned overlay line (same length as candles; nulls break the path). */
export interface OverlayLine { values: (number | null)[]; color: string; width?: number; dash?: boolean }
/** An index-aligned band (Bollinger): a faint fill + edges between upper and lower. */
export interface BandOverlay { upper: (number | null)[]; lower: (number | null)[]; color: string }

const UP = "#16a34a", DOWN = "#dc2626";

/** A persistent horizontal price guide (e.g. an armed alert level). */
export interface PriceGuide { price: number; color: string; label?: string }

export function CandleChart({
  candles,
  height = 240,
  up = null,
  overlays = [],
  band = null,
  volume = null,
  anomalies = [],
  guides = [],
  armed = false,
  onHover,
  onPriceClick,
}: {
  candles: Candle[];
  height?: number;
  up?: boolean | null;
  overlays?: OverlayLine[];
  band?: BandOverlay | null;
  volume?: VolBin[] | null;
  anomalies?: Anomaly[];
  guides?: PriceGuide[];
  armed?: boolean;
  onHover?: (candle: Candle | null, idx: number) => void;
  onPriceClick?: (price: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 640));
    ro.observe(el);
    setW(el.clientWidth || 640);
    return () => ro.disconnect();
  }, []);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const padX = 8, padT = 8;
  const padB = anomalies.length > 0 ? 16 : 8;

  const geom = useMemo(() => {
    const n = candles.length;
    if (n < 1) return null;
    const bandW = (w - 2 * padX) / n;
    const bodyW = Math.max(1, Math.min(14, bandW * 0.62));
    // y-domain spans candle extremes plus every overlay/band value so nothing clips.
    const ys: number[] = [];
    for (const k of candles) { ys.push(k.h, k.l); }
    for (const o of overlays) for (const v of o.values) if (v != null && Number.isFinite(v)) ys.push(v);
    if (band) for (const arr of [band.upper, band.lower]) for (const v of arr) if (v != null && Number.isFinite(v)) ys.push(v);
    const [yLo, yHi] = extent(ys);
    const sy = linear([yLo, yHi], [height - padB, padT]);
    const cx = (i: number) => padX + (i + 0.5) * bandW;
    return { n, bandW, bodyW, sy, cx, yLo, yHi };
  }, [candles, overlays, band, w, height, padB]);

  const [armPrice, setArmPrice] = useState<number | null>(null);

  if (!geom || candles.length < 1) return <div ref={wrapRef} style={{ width: "100%", height }} />;
  const { n, bandW, bodyW, sy, cx, yLo, yHi } = geom;
  // Inverse of sy: pixel-y → price (yLo maps to the axis bottom, yHi to the top).
  const priceAtY = (pix: number) => yLo + (pix - (height - padB)) * ((yHi - yLo) / (padT - (height - padB)));

  // Index-aligned overlay → an SVG path, broken at nulls.
  const linePath = (values: (number | null)[]): string => {
    let d = "", pen = false;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null || !Number.isFinite(v)) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${cx(i).toFixed(1)},${sy(v).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  };

  // Bollinger band fill (only across the contiguous window where both edges exist).
  let bandFill = "";
  if (band) {
    const fwd: string[] = [], back: string[] = [];
    for (let i = 0; i < n; i++) {
      const u = band.upper[i], l = band.lower[i];
      if (u != null && l != null && Number.isFinite(u) && Number.isFinite(l)) {
        fwd.push(`${cx(i).toFixed(1)},${sy(u).toFixed(1)}`);
        back.unshift(`${cx(i).toFixed(1)},${sy(l).toFixed(1)}`);
      }
    }
    if (fwd.length > 1) bandFill = `M${fwd.join(" L")} L${back.join(" L")} Z`;
  }

  // Volume-by-price bars, faint, anchored to the right edge; POC bin stands out.
  const maxVol = volume ? Math.max(1, ...volume.map((b) => b.volume)) : 1;
  const profileW = (w - 2 * padX) * 0.2;

  const hovered = hoverIdx != null && hoverIdx >= 0 && hoverIdx < n ? candles[hoverIdx] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (rect.width ? w / rect.width : 1);
    let idx = Math.floor((px - padX) / bandW);
    if (idx < 0) idx = 0; if (idx >= n) idx = n - 1;
    if (idx !== hoverIdx) { setHoverIdx(idx); onHover?.(candles[idx], idx); }
    if (armed) {
      const py = (e.clientY - rect.top) * (rect.height ? height / rect.height : 1);
      setArmPrice(priceAtY(py));
    }
  };
  const onLeave = () => { setHoverIdx(null); setArmPrice(null); onHover?.(null, -1); };
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!armed || !onPriceClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const py = (e.clientY - rect.top) * (rect.height ? height / rect.height : 1);
    onPriceClick(priceAtY(py));
  };
  const fmtP = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n >= 1 ? 2 : 6 });

  return (
    <div ref={wrapRef} style={{ width: "100%", height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className={`tn-candle${armed ? " is-armed" : ""}`}
        role="img"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
      >
        {/* Volume-by-price profile (behind everything) */}
        {volume?.map((b, i) => {
          const y0 = sy(b.hi), y1 = sy(b.lo);
          const bw = (b.volume / maxVol) * profileW;
          const isPoc = b.volume === maxVol;
          return (
            <rect key={`v${i}`} x={w - padX - bw} y={Math.min(y0, y1)} width={Math.max(0, bw)} height={Math.max(0.5, Math.abs(y1 - y0))}
              fill={isPoc ? "#4a78c9" : "#8aa0b8"} opacity={isPoc ? 0.28 : 0.14} />
          );
        })}

        {/* Bollinger fill + edges */}
        {bandFill && <path d={bandFill} fill={band!.color} opacity="0.08" />}
        {band && <path d={linePath(band.upper)} fill="none" stroke={band.color} strokeWidth="1" opacity="0.5" strokeDasharray="3 3" />}
        {band && <path d={linePath(band.lower)} fill="none" stroke={band.color} strokeWidth="1" opacity="0.5" strokeDasharray="3 3" />}

        {/* Candles: wick + body */}
        {candles.map((k, i) => {
          const green = k.c >= k.o;
          const col = green ? UP : DOWN;
          const x = cx(i);
          const yHi = sy(k.h), yLo = sy(k.l);
          const yO = sy(k.o), yC = sy(k.c);
          const top = Math.min(yO, yC), bot = Math.max(yO, yC);
          const isHover = i === hoverIdx;
          return (
            <g key={k.t} opacity={hoverIdx == null || isHover ? 1 : 0.72}>
              <line x1={x} y1={yHi} x2={x} y2={yLo} stroke={col} strokeWidth="1" />
              <rect x={x - bodyW / 2} y={top} width={bodyW} height={Math.max(1, bot - top)} fill={col} />
            </g>
          );
        })}

        {/* Overlay lines (moving averages, benchmark shape) */}
        {overlays.map((o, i) => (
          <path key={`o${i}`} d={linePath(o.values)} fill="none" stroke={o.color}
            strokeWidth={o.width ?? 1.4} strokeDasharray={o.dash ? "5 4" : undefined}
            opacity={o.dash ? 0.7 : 0.95} strokeLinejoin="round" />
        ))}

        {/* Anomaly anchors on the time axis */}
        {anomalies.map((a) => (
          <g key={`a${a.idx}`}>
            <line x1={cx(a.idx)} y1={height - padB} x2={cx(a.idx)} y2={height - padB + 5} stroke={a.up ? UP : DOWN} strokeWidth="1" />
            <path d={`M${cx(a.idx)},${height - 2} l-3.5,-6 l7,0 Z`} fill={a.up ? UP : DOWN} opacity="0.85">
              <title>{`${a.up ? "+" : ""}${a.pct.toFixed(1)}% — ${new Date(a.t).toLocaleDateString()}`}</title>
            </path>
          </g>
        ))}

        {/* Persistent price guides (armed alert levels) */}
        {guides.map((g, i) => {
          const gy = sy(g.price);
          if (!Number.isFinite(gy)) return null;
          return (
            <g key={`g${i}`}>
              <line x1={padX} y1={gy} x2={w - padX} y2={gy} stroke={g.color} strokeWidth="1" strokeDasharray="4 3" opacity="0.85" />
              <text x={padX + 3} y={gy - 3} fontSize={10} fill={g.color}>{g.label ?? fmtP(g.price)}</text>
            </g>
          );
        })}

        {/* Armed cursor guide: the price the next click would set an alert at */}
        {armed && armPrice != null && (
          <g>
            <line x1={padX} y1={sy(armPrice)} x2={w - padX} y2={sy(armPrice)} stroke="var(--tn-accent, #38bdf8)" strokeWidth="1" strokeDasharray="2 2" />
            <text x={w - padX - 3} y={sy(armPrice) - 3} fontSize={10} textAnchor="end" fill="var(--tn-accent, #38bdf8)">🔔 {fmtP(armPrice)}</text>
          </g>
        )}

        {/* Hover crosshair */}
        {hovered && (
          <line x1={cx(hoverIdx!)} y1={padT} x2={cx(hoverIdx!)} y2={height - padB} stroke="var(--tn-text-faint, #94a3b8)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
        )}
      </svg>
    </div>
  );
}
