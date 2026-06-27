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
// POINT-only for now. Lines/polygons would extend SignalFeature with a geometry
// variant + a matching line/fill layer in WorldMap; everything else is unchanged.
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

/** Every registered signal layer, in rail display order. */
export const SIGNALS: SignalSource[] = [
  EARTHQUAKES_SOURCE,
  WILDFIRES_SOURCE,
  VOLCANOES_SOURCE,
  SEVERE_STORMS_SOURCE,
  FLOODS_SOURCE,
  AURORA_SOURCE,
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
