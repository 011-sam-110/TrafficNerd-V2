import type { AlertRule, Alert } from "@/lib/console/alerts";

export interface CameraLite { id: string; name: string; available: boolean }

export const cameraAlerts: AlertRule<CameraLite> = (cams) => {
  const out: Alert[] = [];
  for (const c of cams) {
    if (!c.available) {
      out.push({ id: `cam-${c.id}`, severity: "warn", text: `${c.name} went offline`, ref: c.id });
    }
  }
  return out;
};
