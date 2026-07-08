// lib/widgets/eventMetrics.ts
// Pure: RAW SignalFeature props → an honest, domain-specific metric line for the
// Events detail feed. Only shows what the source actually provides — no fabricated
// unified "magnitude" for cyclones/disasters (their native fields are shown instead).
import type { EventType } from "@/lib/events/model";

const str = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

export function eventMetricLine(type: EventType, props: Record<string, unknown> | undefined): string {
  if (!props) return "";
  const parts: string[] = [];
  if (type === "quake") {
    const m = str(props.magnitude);
    if (m) parts.push(`M ${m}`);
    const d = str(props.depth);
    if (d) parts.push(`depth ${d}`);
  } else if (type === "cyclone") {
    for (const key of ["category", "maxWind", "pressure"] as const) {
      const v = str(props[key]);
      if (v) parts.push(v);
    }
    const mv = str(props.movement);
    if (mv) parts.push(`moving ${mv}`);
  } else if (type === "disaster") {
    const al = str(props.alertLevel);
    if (al) parts.push(`${al} alert`);
    const c = str(props.country);
    if (c) parts.push(c);
    if (str(props.ongoing).toLowerCase() === "yes") parts.push("ongoing");
  } else {
    const m = str(props.magnitude);
    if (m) parts.push(`M ${m}`);
  }
  return parts.join(" · ");
}
