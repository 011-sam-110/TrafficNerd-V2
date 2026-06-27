import type { SignalFeature, SignalSource } from "@/lib/signals/types";
import { MAJOR_PORTS, type PortRecord } from "@/lib/signals/ports.data";

// Major seaports — a curated STATIC dataset (lib/signals/ports.data.ts) of the
// world's busiest container/cargo ports. Deliberately static, not live: there is
// no reliable keyless "major ports" feed (OSM tags ~3,000+ harbours with no size
// signal). See ports.data.ts for the source + date. Points only.

export const PORTS_ATTRIBUTION = "Major ports: curated from public busiest-port rankings (2023)";

/** Stable slug for a namespaced feature id. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pure: curated port records → SignalFeature[]. */
export function normalizePorts(records: PortRecord[]): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const p of records) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) continue;
    out.push({
      id: `port:${slug(p.name)}`,
      lat: p.lat,
      lon: p.lon,
      title: p.name,
      signalId: "ports",
      color: "#0891b2",
      props: {
        type: "Major seaport",
        ...(p.country ? { country: p.country } : {}),
      },
    });
  }
  return out;
}

export const PORTS_SOURCE: SignalSource = {
  id: "ports",
  label: "Major ports",
  group: "Infrastructure",
  color: "#0891b2",
  refreshMs: 24 * 60 * 60 * 1000, // static data — long cadence
  attribution: PORTS_ATTRIBUTION,
  async fetch() {
    // No network: a curated static list, so this is trivially dormant-safe.
    return normalizePorts(MAJOR_PORTS);
  },
};
