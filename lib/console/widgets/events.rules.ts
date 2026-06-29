import type { AlertRule, Alert } from "@/lib/console/alerts";
import type { EventType, SeverityTier } from "@/lib/events/model";

export interface EventLite {
  id: string;
  type: EventType;
  tier: SeverityTier;
  title: string;
  magnitude?: number;
}

export const eventAlerts: AlertRule<EventLite> = (events) => {
  const out: Alert[] = [];
  for (const e of events) {
    const bigTier = e.tier === "S4" || e.tier === "S3";
    const bigQuake = e.type === "quake" && (e.magnitude ?? 0) >= 5;
    if (bigTier || bigQuake) {
      const severity = e.tier === "S4" ? "critical" : e.tier === "S3" ? "warn" : "warn";
      out.push({ id: `ev-${e.id}`, severity, text: e.title, ref: e.id });
    }
  }
  return out;
};
