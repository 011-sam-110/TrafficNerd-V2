// A tiny inline severity bar for monitor rows: a proportional track fill in the
// source's severity-ramp colour + a right-aligned tabular numeric label. Pure /
// presentational (mirrors Sparkline). The fill width encodes magnitude within the
// source's declared [calm, extreme] domain, so a glance down a list reads severity
// as bar length, not just a number. The fill carries a faint inset border so the
// low (lime/amber) end of the ramp stays visible on the light track in both themes.

export function MetricBar({
  value,
  domain,
  color,
  label,
}: {
  value: number;
  domain: [number, number];
  /** The feature's severity-ramp colour; falls back to the neutral accent. */
  color?: string;
  /** Pre-formatted numeric label (e.g. "5.8", "88"). */
  label: string;
}) {
  const [lo, hi] = domain;
  const pct = hi > lo ? Math.min(1, Math.max(0, (value - lo) / (hi - lo))) * 100 : 0;
  return (
    <span className="tn-w-bar">
      <span className="tn-w-bar-track" aria-hidden>
        <span className="tn-w-bar-fill" style={{ width: `${pct.toFixed(1)}%`, background: color || "var(--tn-accent)" }} />
      </span>
      <span className="tn-w-bar-num">{label}</span>
    </span>
  );
}
