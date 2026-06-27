// ENTSO-E bidding-zone EIC codes → a representative coordinate + label. The grid
// API is keyed by 16-char EIC "domain" codes, not countries, so this is the join
// table that lets us plot one marker per zone. Covers the principal European
// bidding zones (a zone is usually a country; a few countries are split). Anchors
// are a central point in each zone — a label location, not a substation.

export interface EntsoeZone {
  eic: string;
  name: string;
  lat: number;
  lon: number;
}

export const ENTSOE_ZONES: EntsoeZone[] = [
  { eic: "10YAT-APG------L", name: "Austria", lat: 47.6, lon: 14.1 },
  { eic: "10YBE----------2", name: "Belgium", lat: 50.6, lon: 4.7 },
  { eic: "10YCZ-CEPS-----N", name: "Czechia", lat: 49.8, lon: 15.5 },
  { eic: "10Y1001A1001A65H", name: "Denmark", lat: 56.0, lon: 9.5 },
  { eic: "10Y1001A1001A39I", name: "Estonia", lat: 58.7, lon: 25.5 },
  { eic: "10YFI-1--------U", name: "Finland", lat: 64.5, lon: 26.0 },
  { eic: "10YFR-RTE------C", name: "France", lat: 46.6, lon: 2.5 },
  { eic: "10Y1001A1001A83F", name: "Germany", lat: 51.2, lon: 10.4 },
  { eic: "10YGR-HTSO-----Y", name: "Greece", lat: 39.1, lon: 22.9 },
  { eic: "10YHU-MAVIR----U", name: "Hungary", lat: 47.2, lon: 19.5 },
  { eic: "10YIE-1001A00010", name: "Ireland", lat: 53.4, lon: -8.0 },
  { eic: "10YIT-GRTN-----B", name: "Italy", lat: 42.8, lon: 12.6 },
  { eic: "10YLV-1001A00074", name: "Latvia", lat: 56.9, lon: 24.9 },
  { eic: "10YLT-1001A0008Q", name: "Lithuania", lat: 55.3, lon: 23.9 },
  { eic: "10YNL----------L", name: "Netherlands", lat: 52.2, lon: 5.3 },
  { eic: "10YNO-0--------C", name: "Norway", lat: 64.5, lon: 11.0 },
  { eic: "10YPL-AREA-----S", name: "Poland", lat: 52.0, lon: 19.4 },
  { eic: "10YPT-REN------W", name: "Portugal", lat: 39.6, lon: -8.0 },
  { eic: "10YRO-TEL------P", name: "Romania", lat: 45.9, lon: 25.0 },
  { eic: "10YSK-SEPS-----K", name: "Slovakia", lat: 48.7, lon: 19.7 },
  { eic: "10YSI-ELES-----O", name: "Slovenia", lat: 46.1, lon: 14.8 },
  { eic: "10YES-REE------0", name: "Spain", lat: 40.2, lon: -3.7 },
  { eic: "10YSE-1--------K", name: "Sweden", lat: 62.0, lon: 15.0 },
  { eic: "10YCH-SWISSGRIDZ", name: "Switzerland", lat: 46.8, lon: 8.2 },
  { eic: "10YGB----------A", name: "Great Britain", lat: 54.0, lon: -2.5 },
];

const BY_EIC = new Map(ENTSOE_ZONES.map((z) => [z.eic, z]));

export function zoneByEic(eic: string): EntsoeZone | undefined {
  return BY_EIC.get(eic.trim());
}
