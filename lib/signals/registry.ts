// ===========================================================================
// Global-signals registry — the single list of keyless, opt-in, global point
// layers the app can render. This is the FOUNDATION later batches extend.
//
// ── To add a new signal layer (ONE adapter + ONE entry, nothing else): ──
//   1. Write  lib/signals/<x>.ts  exporting a `SignalSource`
//      (see lib/signals/types.ts): `fetch()` returns `SignalFeature[]` from a
//      keyless endpoint and MUST resolve to `[]` on any failure (never reject).
//      Keep the upstream→SignalFeature mapping in a PURE exported function.
//   2. Add that source to `SIGNALS` below.
//   3. Add a captured fixture + a unit test for the pure normaliser
//      (mirror tests/unit/signals-*.test.ts).
//   That is the whole checklist. No edits to WorldMap, the dynamic API route,
//   the dossier, the store, or the rail — they are all data-driven off `SIGNALS`.
//
// How the pieces fit:
//   • Store     lib/signals/store.ts  — which ids are ON (default all OFF) + counts
//   • Route     app/api/signals/[id]/route.ts — generic getSignal(id).fetch()
//   • Render    components/WorldMap.tsx — ONE aggregated `signals` GeoJSON source
//                 + one data-driven circle+label layer (colour/radius from props)
//   • Dossier   components/SignalDetail.tsx via lib/overlay-content.tsx (kind:"signal")
//   • Rail      components/shell/LayerRail.tsx — auto-grouped "Global signals" section
//
// POINTS, LINES and POLYGONS are all supported. A source whose features carry a
// `geometry` (SignalFeature.geometry: LineString/MultiLineString → line layer,
// Polygon/MultiPolygon → fill layer) renders on the dedicated line/fill sources
// in WorldMap; plain points keep the circle layer. lat/lon stays the click /
// label / dossier anchor for every kind. The registry/store/route/dossier
// plumbing is identical regardless of geometry — see lib/signals/types.ts.
// ===========================================================================

import type { SignalSource } from "@/lib/signals/types";
import { EARTHQUAKES_SOURCE } from "@/lib/signals/usgs";
import {
  WILDFIRES_SOURCE,
  VOLCANOES_SOURCE,
  SEVERE_STORMS_SOURCE,
  FLOODS_SOURCE,
} from "@/lib/signals/eonet";
import { AURORA_SOURCE } from "@/lib/signals/aurora";
import { LAUNCHES_SOURCE } from "@/lib/signals/launches";
import { CABLES_SOURCE } from "@/lib/signals/cables";
import { GPS_JAMMING_SOURCE } from "@/lib/signals/gpsjam";
import { NUCLEAR_SOURCE } from "@/lib/signals/nuclear";
import { AIRPORTS_SOURCE } from "@/lib/signals/airports";
import { PORTS_SOURCE } from "@/lib/signals/ports";
import { CONFLICT_SOURCE, PROTESTS_SOURCE } from "@/lib/signals/gdelt";
import { GDACS_SOURCE } from "@/lib/signals/gdacs";
import { WEATHER_SOURCE } from "@/lib/signals/weather";
import { AIR_QUALITY_SOURCE } from "@/lib/signals/airquality";
import { UK_CRIME_SOURCE } from "@/lib/signals/crime";

/** Every registered signal layer, in rail display order. */
export const SIGNALS: SignalSource[] = [
  EARTHQUAKES_SOURCE,
  WILDFIRES_SOURCE,
  VOLCANOES_SOURCE,
  SEVERE_STORMS_SOURCE,
  FLOODS_SOURCE,
  GDACS_SOURCE, // multi-hazard GDACS alerts (EQ/TC/FL/VO/DR/WF), alert-coloured
  AURORA_SOURCE,
  // Space
  LAUNCHES_SOURCE,
  // Infrastructure (cables = line layer, gpsJamming = fill layer)
  CABLES_SOURCE,
  GPS_JAMMING_SOURCE,
  NUCLEAR_SOURCE,
  AIRPORTS_SOURCE,
  PORTS_SOURCE,
  // Intel (GDELT geolocated news coverage)
  CONFLICT_SOURCE,
  PROTESTS_SOURCE,
  // Environment & civic (keyless Open-Meteo + data.police.uk)
  WEATHER_SOURCE,
  AIR_QUALITY_SOURCE,
  UK_CRIME_SOURCE,
];

/** Lookup a source by id (the dynamic route + store key). */
export function getSignal(id: string): SignalSource | undefined {
  return SIGNALS.find((s) => s.id === id);
}

/** Registry grouped by `group`, preserving registration order — used by the rail. */
export function signalsByGroup(): { group: string; sources: SignalSource[] }[] {
  const groups: { group: string; sources: SignalSource[] }[] = [];
  for (const s of SIGNALS) {
    let g = groups.find((x) => x.group === s.group);
    if (!g) {
      g = { group: s.group, sources: [] };
      groups.push(g);
    }
    g.sources.push(s);
  }
  return groups;
}
