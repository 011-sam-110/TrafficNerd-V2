import type { AlertRule, Alert } from "@/lib/console/alerts";

export interface PlaneLite {
  callsign: string;
  squawk?: string;
  isMilitary?: boolean;
  /** True when this is a business/private jet (by ICAO type — see lib/planes/bizjet). */
  isBizjet?: boolean;
  /** True when the aircraft reports itself on the ground (excluded from the surge count). */
  onGround?: boolean;
}

const EMERGENCY = new Set(["7500", "7600", "7700"]);
const REASON: Record<string, string> = {
  "7500": "hijack",
  "7600": "radio failure",
  "7700": "emergency",
};

/**
 * Aviation alerts:
 *  • emergency squawk (7500/7600/7700) → critical, one per aircraft
 *  • military callsign → info
 *  • business-jet surge → warn ONCE while ≥ `config.jetSurgeMin` private jets are
 *    airborne at the same time (a single stable-ref alert so it fires on the
 *    crossing, not per plane). Opt-in: no threshold ⇒ no surge alert.
 */
export const aviationAlerts: AlertRule<PlaneLite> = (planes, config) => {
  const out: Alert[] = [];
  let airborneJets = 0;
  for (const p of planes) {
    if (p.isBizjet && !p.onGround) airborneJets++;
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

  const surgeMin = Number(config?.jetSurgeMin);
  if (Number.isFinite(surgeMin) && surgeMin > 0 && airborneJets >= surgeMin) {
    out.push({
      id: "jet-surge",
      severity: "warn",
      text: `${airborneJets} private jets airborne at once (≥ ${surgeMin})`,
      ref: "jet-surge",
    });
  }
  return out;
};
