// Pure aggregation for the AIS chokepoint congestion board — turns a flat stream
// of vessel positions into one status row per strait (count, moving vs stopped,
// average speed, a congestion read). Node-testable; no fabrication — a strait with
// too few vessels to judge reports "unknown" rather than a made-up level.
import type { SignalFeature } from "@/lib/signals/types";

export type Congestion = "flowing" | "busy" | "congested" | "unknown";

export interface ChokepointStat {
  name: string;
  total: number;
  moving: number;
  stopped: number;
  /** Mean speed of the moving vessels (kt), or null when none are under way. */
  avgSpeed: number | null;
  congestion: Congestion;
}

/** Congestion read from the stopped/total ratio. Honest "unknown" below a usable sample. */
export function congestionLevel(stopped: number, total: number): Congestion {
  if (total < 4) return "unknown"; // too few vessels to call it
  const ratio = stopped / total;
  if (ratio >= 0.6) return "congested";
  if (ratio >= 0.35) return "busy";
  return "flowing";
}

/** Group AIS vessel features by their tagged chokepoint and summarise each strait. */
export function summarizeChokepoints(features: SignalFeature[]): ChokepointStat[] {
  const groups = new Map<string, SignalFeature[]>();
  for (const f of features) {
    const cp = typeof f.props?.chokepoint === "string" ? f.props.chokepoint : "Open water";
    const arr = groups.get(cp);
    if (arr) arr.push(f);
    else groups.set(cp, [f]);
  }
  const stats: ChokepointStat[] = [];
  for (const [name, fs] of groups) {
    let moving = 0, stopped = 0, spSum = 0, spN = 0;
    for (const f of fs) {
      const sp = typeof f.props?.speedKt === "number" ? f.props.speedKt : null;
      if (sp != null && sp > 0.5) { moving++; spSum += sp; spN++; }
      else stopped++;
    }
    stats.push({ name, total: fs.length, moving, stopped, avgSpeed: spN ? spSum / spN : null, congestion: congestionLevel(stopped, fs.length) });
  }
  // Busiest straits first; "Open water" (untagged) always sinks to the bottom.
  return stats.sort((a, b) => (a.name === "Open water" ? 1 : b.name === "Open water" ? -1 : b.total - a.total));
}

/** Congestion → status hue (theme-independent, like the map severity swatches). */
export function congestionColor(level: Congestion): string {
  switch (level) {
    case "flowing": return "#16a34a";
    case "busy": return "#d9882f";
    case "congested": return "#d9534f";
    default: return "#64748b"; // unknown
  }
}
