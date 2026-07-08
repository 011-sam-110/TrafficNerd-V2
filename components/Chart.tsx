// components/Chart.tsx
// Native SVG line/area chart — the shared, dependency-free charting primitive
// (generalises Sparkline). Presentational: caller supplies {x,y} points already
// in data space. Renders nothing below 2 points. up tints the stroke green/red.
import { extent, linear } from "@/lib/chart/scale";

export interface ChartPoint { x: number; y: number }

export function Chart({
  points,
  width = 640,
  height = 200,
  area = true,
  up,
  zeroBaseline = true,
  markers = false,
}: {
  points: ChartPoint[];
  width?: number;
  height?: number;
  area?: boolean;
  up?: boolean | null;
  /** Anchor the y-scale at 0 (default, true — every existing caller). Set false so
   *  price series that sit far from 0 auto-fit instead of squashing to a corner. */
  zeroBaseline?: boolean;
  /** Draw min-low / max-high / last dots with tiny value labels (price charts). */
  markers?: boolean;
}) {
  if (!points || points.length < 2) return null;
  const pad = 6;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const sx = linear(extent(xs), [pad, width - pad]);
  const sy = linear(extent(zeroBaseline === false ? ys : [0, ...ys]), [height - pad, pad]); // baseline at 0 unless opted out
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const stroke = up == null ? "var(--tn-accent, #38bdf8)" : up ? "#16a34a" : "#dc2626";
  const fillPath = `${line} L${sx(points[points.length - 1].x).toFixed(1)},${(height - pad).toFixed(1)} L${sx(points[0].x).toFixed(1)},${(height - pad).toFixed(1)} Z`;

  // Value markers: the extremes and the latest point. Kept behind `markers` so no
  // existing caller changes. Labels are horizontally stretched by the parent's
  // preserveAspectRatio="none"; acceptable for the tiny annotations they are.
  const fmtMarker = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const markerDots: { p: ChartPoint; dy: number; anchor: "start" | "middle" | "end" }[] = [];
  if (markers) {
    let lo = points[0], hi = points[0];
    for (const p of points) { if (p.y < lo.y) lo = p; if (p.y > hi.y) hi = p; }
    const last = points[points.length - 1];
    markerDots.push({ p: hi, dy: -5, anchor: "middle" }, { p: lo, dy: 12, anchor: "middle" }, { p: last, dy: -5, anchor: "end" });
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="tn-chart" preserveAspectRatio="none" role="img">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--tn-border, #1e293b)" strokeWidth="1" />
      {area && <path d={fillPath} fill={stroke} opacity="0.12" />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {markerDots.length > 0 && (
        <g>
          {markerDots.map(({ p, dy, anchor }, i) => {
            const cx = sx(p.x), cy = sy(p.y);
            const tx = Math.min(width - pad, Math.max(pad, cx));
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={2.5} fill={stroke} />
                <text x={tx} y={cy + dy} fontSize={9} textAnchor={anchor} fill="var(--tn-text-faint, #94a3b8)">{fmtMarker(p.y)}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
