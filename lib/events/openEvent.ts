"use client";
// Row-click action for the Disasters & Events feed: pan+zoom the globe to the
// event's coordinates and (when we can join back to the raw SignalFeature) open
// the SAME signal dossier a map click would — so a feed row behaves exactly like
// clicking that hazard on the map. Reuses mapViewStore.flyToPoint + overlay +
// buildSignalObject; no map logic is duplicated. Kept side-effect-only here; the
// pure zoom pick is exported for unit testing.

import { overlay } from "@/lib/overlay";
import { mapViewStore } from "@/lib/mapView";
import { buildSignalObject } from "@/lib/widgets/signalObject";
import type { SignalFeature } from "@/lib/signals/types";
import type { NormalizedEvent, GeoPrecision } from "@/lib/events/model";

/** Sensible fly-to zoom by the point's geo precision (exact quake vs country centroid). */
export function zoomForPrecision(precision: GeoPrecision): number {
  switch (precision) {
    case "EXACT": return 6;
    case "CITY": return 5.5;
    case "ADMIN": return 4.5;
    case "COUNTRY_CENTROID": return 3.5;
    default: return 4.5;
  }
}

/**
 * Fly to an event and, when the raw feature is available, open its dossier.
 * `feature` is optional so the compact widget can link even before the raw
 * SignalFeature map is built (it still flies).
 */
export function openEvent(
  event: NormalizedEvent,
  feature?: SignalFeature,
  sourceLabel?: string,
): void {
  if (feature) overlay.open(buildSignalObject(feature, sourceLabel ?? event.source.label));
  mapViewStore.flyToPoint({
    lat: event.geo.lat,
    lon: event.geo.lon,
    zoom: zoomForPrecision(event.geo.precision),
  });
}
