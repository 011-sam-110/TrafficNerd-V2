export type AlertSeverity = "info" | "warn" | "critical";
export interface Alert { id: string; severity: AlertSeverity; text: string; ts?: number; ref?: string }
export type AlertRule<T> = (items: T[], config: Record<string, unknown>) => Alert[];

const RANK: Record<AlertSeverity, number> = { info: 0, warn: 1, critical: 2 };

export function runAlertRule<T>(rule: AlertRule<T>, items: T[], config: Record<string, unknown>): Alert[] {
  try { return rule(items, config); } catch { return []; }
}
export function alertCount(alerts: Alert[]): number { return alerts.length; }
export function topSeverity(alerts: Alert[]): AlertSeverity | null {
  if (alerts.length === 0) return null;
  return alerts.reduce((top, a) => (RANK[a.severity] > RANK[top] ? a.severity : top), "info" as AlertSeverity);
}
