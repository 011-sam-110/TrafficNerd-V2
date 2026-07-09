"use client";
// components/news/HeadlineBars.tsx
// Interactive "headlines per hour" timeline — a dependency-free SVG bar strip
// where each hour bucket is clickable to filter the feed to that hour (click the
// active bar again, or the Reset control the parent renders, to clear). Kept
// separate from components/Chart.tsx (that primitive is owned by the markets
// stream) since this one needs per-bar hit targets + selection state.

import type { TimeBin } from "@/lib/widgets/buckets";

export function HeadlineBars({
  bins,
  selected,
  onSelect,
  height = 68,
}: {
  bins: TimeBin[];
  /** start-ms of the selected bucket, or null. */
  selected: number | null;
  onSelect: (startMs: number | null) => void;
  height?: number;
}) {
  if (!bins || bins.length === 0) return null;
  const width = 720;
  const padX = 4;
  const padTop = 6;
  const axis = 14; // room for hour ticks under the baseline
  const max = Math.max(1, ...bins.map((b) => b.count));
  const n = bins.length;
  const slot = (width - padX * 2) / n;
  const barW = Math.max(2, slot * 0.72);
  const plotH = height - padTop - axis;
  const baseY = height - axis;
  const fmtHour = (t: number) => {
    const d = new Date(t);
    const h = d.getHours();
    return `${h.toString().padStart(2, "0")}h`;
  };

  return (
    <svg
      className="tn-hd-bars"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="group"
      aria-label="Headlines per hour, last 24 hours — click a bar to filter"
    >
      <line x1={padX} y1={baseY} x2={width - padX} y2={baseY} stroke="var(--tn-border, #1e293b)" strokeWidth="1" />
      {bins.map((b, i) => {
        const h = b.count > 0 ? Math.max(2, (b.count / max) * plotH) : 0;
        const x = padX + i * slot + (slot - barW) / 2;
        const y = baseY - h;
        const isSel = selected === b.start;
        const active = selected == null || isSel;
        const label = `${fmtHour(b.start)} · ${b.count} headline${b.count === 1 ? "" : "s"}`;
        return (
          <g key={b.start} className="tn-hd-bar-g" onClick={() => onSelect(isSel ? null : b.start)}>
            {/* full-height transparent hit target so thin/empty bars are still clickable */}
            <rect x={padX + i * slot} y={padTop} width={slot} height={height - padTop} fill="transparent">
              <title>{label}</title>
            </rect>
            {h > 0 && (
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={1}
                className={`tn-hd-bar${isSel ? " is-sel" : ""}`}
                opacity={active ? 1 : 0.35}
              />
            )}
            {/* sparse hour ticks: every 6 buckets + the last */}
            {(i % 6 === 0 || i === n - 1) && (
              <text x={padX + i * slot + slot / 2} y={height - 3} className="tn-hd-bar-tick" textAnchor="middle">
                {fmtHour(b.start)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
