// Pure coverage/honesty maths for the Cameras focus view. A camera is offline when
// unavailable, "live" when it exposes an allowlisted HLS stream, else a refreshing
// still. Grouped per operator so the console can be honest about what each feed is.
export interface CameraLite {
  id: string; source: string; name: string; lat: number; lon: number;
  available: boolean; live: boolean; region?: string;
}

export interface OperatorCoverage {
  source: string; total: number; live: number; still: number; offline: number;
}
export interface Coverage {
  total: number; live: number; still: number; offline: number;
  byOperator: OperatorCoverage[];
}

export function coverage(cams: CameraLite[]): Coverage {
  const ops = new Map<string, OperatorCoverage>();
  let live = 0, still = 0, offline = 0;
  for (const c of cams) {
    const bucket: "live" | "still" | "offline" = !c.available ? "offline" : c.live ? "live" : "still";
    if (bucket === "live") live++; else if (bucket === "still") still++; else offline++;
    let o = ops.get(c.source);
    if (!o) { o = { source: c.source, total: 0, live: 0, still: 0, offline: 0 }; ops.set(c.source, o); }
    o.total++; o[bucket]++;
  }
  const byOperator = [...ops.values()].sort((a, b) => b.total - a.total);
  return { total: cams.length, live, still, offline, byOperator };
}

/**
 * Wall ordering comparator: working-live first, then working-still, then offline last
 * (name-tiebroken). "live" is gated on availability — an offline feed can still carry an
 * allowlisted stream URL (live=true, available=false), and ranking those ahead of working
 * stills would fill a bounded wall with "Feed offline" tiles while hiding usable feeds.
 */
export function byWallPriority(a: CameraLite, b: CameraLite): number {
  return (
    Number(b.live && b.available) - Number(a.live && a.available) ||
    Number(b.available) - Number(a.available) ||
    a.name.localeCompare(b.name)
  );
}
