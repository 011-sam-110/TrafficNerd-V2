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
}: {
  points: ChartPoint[];
  width?: number;
  height?: number;
  area?: boolean;
  up?: boolean | null;
}) {
  if (!points || points.length < 2) return null;
  const pad = 6;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const sx = linear(extent(xs), [pad, width - pad]);
  const sy = linear(extent([0, ...ys]), [height - pad, pad]); // baseline at 0
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const stroke = up == null ? "var(--tn-accent, #38bdf8)" : up ? "#16a34a" : "#dc2626";
  const fillPath = `${line} L${sx(points[points.length - 1].x).toFixed(1)},${(height - pad).toFixed(1)} L${sx(points[0].x).toFixed(1)},${(height - pad).toFixed(1)} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="tn-chart" preserveAspectRatio="none" role="img">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--tn-border, #1e293b)" strokeWidth="1" />
      {area && <path d={fillPath} fill={stroke} opacity="0.12" />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
