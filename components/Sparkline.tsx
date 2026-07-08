// A tiny inline sparkline. `values` are normalized 0..1 (see seriesTrend); the
// last point is the newest. Renders nothing below 2 points so an empty series
// is silent rather than a flat stub. Pure/presentational — no data access here.

export function Sparkline({
  values,
  width = 52,
  height = 14,
  up,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** Tints the line green/red; defaults to neutral. */
  up?: boolean | null;
}) {
  if (!values || values.length < 2) return null;
  const step = width / (values.length - 1);
  const pad = 1.2;
  const pts = values
    .map((v, i) => {
      const y = height - pad - v * (height - pad * 2);
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = up == null ? "var(--tn-text-faint, #94a3b8)" : up ? "#16a34a" : "#dc2626";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="tn-sparkline"
      aria-hidden
      preserveAspectRatio="none"
    >
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
