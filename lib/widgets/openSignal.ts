"use client";
// The shared widget row-click action: open the existing signal dossier for a
// feature AND fly the globe to it. Reuses overlay + mapViewStore so a widget row
// behaves exactly like clicking that signal on the map.

import { overlay } from "@/lib/overlay";
import { mapViewStore } from "@/lib/mapView";
import { buildSignalObject } from "@/lib/widgets/signalObject";
import type { SignalFeature } from "@/lib/signals/types";

export function openSignalFeature(f: SignalFeature, sourceLabel: string, zoom = 5): void {
  overlay.open(buildSignalObject(f, sourceLabel));
  mapViewStore.flyToPoint({ lat: f.lat, lon: f.lon, zoom });
}
