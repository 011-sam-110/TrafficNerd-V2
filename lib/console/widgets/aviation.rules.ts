import type { AlertRule, Alert } from "@/lib/console/alerts";

export interface PlaneLite {
  callsign: string;
  squawk?: string;
  isMilitary?: boolean;
}

const EMERGENCY = new Set(["7500", "7600", "7700"]);
const REASON: Record<string, string> = {
  "7500": "hijack",
  "7600": "radio failure",
  "7700": "emergency",
};

export const aviationAlerts: AlertRule<PlaneLite> = (planes) => {
  const out: Alert[] = [];
  for (const p of planes) {
    if (p.squawk && EMERGENCY.has(p.squawk)) {
      out.push({
        id: `sq-${p.callsign}`,
        severity: "critical",
        text: `${p.callsign} squawk ${p.squawk} — ${REASON[p.squawk]}`,
        ref: p.callsign,
      });
    } else if (p.isMilitary) {
      out.push({
        id: `mil-${p.callsign}`,
        severity: "info",
        text: `Military ${p.callsign} in region`,
        ref: p.callsign,
      });
    }
  }
  return out;
};
