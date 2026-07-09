// lib/events/hubs.ts
// A small CURATED REFERENCE SET of major global logistics hubs (container ports,
// international airports, and manufacturing clusters) with real, published
// coordinates. It exists so a severe event can surface the downstream hubs that
// sit nearby and could face disruption — WITHOUT fabricating any per-event figure.
//
// HONESTY / SCOPE:
//   • This is a hand-curated sample of ~50 of the world's largest hubs, NOT an
//     exhaustive or authoritative facilities database. Coordinates are approximate
//     hub centroids.
//   • `nearbyHubs` only computes great-circle distance (haversine). It NEVER claims
//     a closure, an ETA, or a dollar impact — the caller phrases results as
//     "hubs within N km (potential disruption)".

import { haversineKm } from "@/lib/geo/haversine";
import type { NormalizedEvent } from "@/lib/events/model";

export type HubType = "port" | "airport" | "manufacturing";

export interface Hub {
  name: string;
  type: HubType;
  country: string;
  lat: number;
  lon: number;
}

export const HUB_TYPE_LABEL: Record<HubType, string> = {
  port: "Port",
  airport: "Airport",
  manufacturing: "Mfg. hub",
};

/** Curated reference set — ~50 major global logistics hubs. */
export const HUBS: Hub[] = [
  // ── Container ports (throughput leaders) ─────────────────────────────
  { name: "Port of Shanghai", type: "port", country: "China", lat: 30.63, lon: 122.07 },
  { name: "Port of Singapore", type: "port", country: "Singapore", lat: 1.26, lon: 103.83 },
  { name: "Port of Ningbo-Zhoushan", type: "port", country: "China", lat: 29.87, lon: 121.83 },
  { name: "Port of Shenzhen", type: "port", country: "China", lat: 22.55, lon: 113.88 },
  { name: "Port of Guangzhou", type: "port", country: "China", lat: 23.09, lon: 113.49 },
  { name: "Port of Busan", type: "port", country: "South Korea", lat: 35.10, lon: 129.04 },
  { name: "Port of Qingdao", type: "port", country: "China", lat: 36.09, lon: 120.31 },
  { name: "Port of Hong Kong", type: "port", country: "Hong Kong", lat: 22.30, lon: 114.13 },
  { name: "Port of Rotterdam", type: "port", country: "Netherlands", lat: 51.95, lon: 4.14 },
  { name: "Port of Antwerp-Bruges", type: "port", country: "Belgium", lat: 51.28, lon: 4.34 },
  { name: "Port of Hamburg", type: "port", country: "Germany", lat: 53.54, lon: 9.93 },
  { name: "Port of Los Angeles / Long Beach", type: "port", country: "USA", lat: 33.74, lon: -118.26 },
  { name: "Port of New York & New Jersey", type: "port", country: "USA", lat: 40.66, lon: -74.09 },
  { name: "Port of Jebel Ali (Dubai)", type: "port", country: "UAE", lat: 25.01, lon: 55.06 },
  { name: "Port of Tanjung Pelepas", type: "port", country: "Malaysia", lat: 1.36, lon: 103.55 },
  { name: "Port of Kaohsiung", type: "port", country: "Taiwan", lat: 22.61, lon: 120.28 },
  { name: "Port of Colombo", type: "port", country: "Sri Lanka", lat: 6.95, lon: 79.84 },
  { name: "Port of Piraeus", type: "port", country: "Greece", lat: 37.94, lon: 23.63 },
  { name: "Port of Santos", type: "port", country: "Brazil", lat: -23.98, lon: -46.30 },
  { name: "Port of Valencia", type: "port", country: "Spain", lat: 39.44, lon: -0.31 },
  { name: "Port of Tokyo / Yokohama", type: "port", country: "Japan", lat: 35.45, lon: 139.68 },
  { name: "Suez Canal (Port Said)", type: "port", country: "Egypt", lat: 31.25, lon: 32.30 },
  { name: "Panama Canal (Balboa)", type: "port", country: "Panama", lat: 8.95, lon: -79.56 },

  // ── International airports (passenger + cargo gateways) ───────────────
  { name: "Hartsfield-Jackson Atlanta (ATL)", type: "airport", country: "USA", lat: 33.64, lon: -84.43 },
  { name: "Dubai Intl (DXB)", type: "airport", country: "UAE", lat: 25.25, lon: 55.36 },
  { name: "Beijing Capital (PEK)", type: "airport", country: "China", lat: 40.08, lon: 116.60 },
  { name: "London Heathrow (LHR)", type: "airport", country: "UK", lat: 51.47, lon: -0.45 },
  { name: "Tokyo Haneda (HND)", type: "airport", country: "Japan", lat: 35.55, lon: 139.78 },
  { name: "Los Angeles Intl (LAX)", type: "airport", country: "USA", lat: 33.94, lon: -118.41 },
  { name: "Chicago O'Hare (ORD)", type: "airport", country: "USA", lat: 41.98, lon: -87.90 },
  { name: "Paris Charles de Gaulle (CDG)", type: "airport", country: "France", lat: 49.01, lon: 2.55 },
  { name: "Frankfurt (FRA)", type: "airport", country: "Germany", lat: 50.04, lon: 8.56 },
  { name: "Amsterdam Schiphol (AMS)", type: "airport", country: "Netherlands", lat: 52.31, lon: 4.76 },
  { name: "Singapore Changi (SIN)", type: "airport", country: "Singapore", lat: 1.36, lon: 103.99 },
  { name: "Hong Kong Intl (HKG)", type: "airport", country: "Hong Kong", lat: 22.31, lon: 113.91 },
  { name: "Seoul Incheon (ICN)", type: "airport", country: "South Korea", lat: 37.46, lon: 126.44 },
  { name: "Memphis Intl (MEM cargo)", type: "airport", country: "USA", lat: 35.04, lon: -89.98 },
  { name: "Indira Gandhi Delhi (DEL)", type: "airport", country: "India", lat: 28.56, lon: 77.10 },
  { name: "İstanbul (IST)", type: "airport", country: "Türkiye", lat: 41.26, lon: 28.74 },

  // ── Manufacturing clusters ───────────────────────────────────────────
  { name: "Shenzhen electronics cluster", type: "manufacturing", country: "China", lat: 22.54, lon: 114.06 },
  { name: "Suzhou industrial park", type: "manufacturing", country: "China", lat: 31.31, lon: 120.67 },
  { name: "Taipei/Hsinchu semiconductor belt", type: "manufacturing", country: "Taiwan", lat: 24.78, lon: 120.99 },
  { name: "Penang (Bayan Lepas) tech hub", type: "manufacturing", country: "Malaysia", lat: 5.29, lon: 100.28 },
  { name: "Ho Chi Minh City mfg. zone", type: "manufacturing", country: "Vietnam", lat: 10.82, lon: 106.63 },
  { name: "Chennai auto cluster", type: "manufacturing", country: "India", lat: 12.99, lon: 80.16 },
  { name: "Toyota City", type: "manufacturing", country: "Japan", lat: 35.08, lon: 137.16 },
  { name: "Stuttgart auto cluster", type: "manufacturing", country: "Germany", lat: 48.78, lon: 9.18 },
  { name: "Monterrey mfg. hub", type: "manufacturing", country: "Mexico", lat: 25.67, lon: -100.31 },
  { name: "Guadalajara electronics hub", type: "manufacturing", country: "Mexico", lat: 20.67, lon: -103.35 },
  { name: "Bengaluru tech hub", type: "manufacturing", country: "India", lat: 12.97, lon: 77.59 },
  { name: "Guanajuato/Bajío auto belt", type: "manufacturing", country: "Mexico", lat: 21.02, lon: -101.26 },
];

export interface NearbyHub {
  hub: Hub;
  distanceKm: number;
}

/**
 * PURE: hubs within `radiusKm` of an event's anchor, nearest first. Caller decides
 * the radius (typically the event's modelled impact radius). No disruption claim is
 * made here beyond proximity.
 */
export function nearbyHubs(event: NormalizedEvent, radiusKm: number, hubs: Hub[] = HUBS): NearbyHub[] {
  const out: NearbyHub[] = [];
  for (const hub of hubs) {
    const distanceKm = haversineKm(event.geo.lat, event.geo.lon, hub.lat, hub.lon);
    if (distanceKm <= radiusKm) out.push({ hub, distanceKm });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}
