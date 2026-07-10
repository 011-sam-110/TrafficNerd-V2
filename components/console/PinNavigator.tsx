"use client";
// The pin navigator — a compact control by the map-view buttons that flicks through
// your dropped pins. Shows "n / total" + the active pin's label, ◀ ▶ to walk them
// (flying the camera to each), a "locate" tap to re-centre on the active pin, and ✕
// to drop it. Hidden when there are no pins. Reads the shared pinsStore, so it stays
// in sync with the search bar and right-click adds. (Mounted only over a live map.)

import { useMapPins, pinsStore, type MapPin } from "@/lib/map/pins";
import { mapViewStore } from "@/lib/mapView";

function flyTo(pin: MapPin | null) {
  if (pin) mapViewStore.flyToPoint({ lat: pin.lat, lon: pin.lon, zoom: 9 });
}

export default function PinNavigator() {
  const { pins, activeId } = useMapPins();
  if (pins.length === 0) return null;

  const idx = pins.findIndex((p) => p.id === activeId);
  const active = idx >= 0 ? pins[idx] : null;

  return (
    <div className="tn-pinnav" role="group" aria-label="Map pins">
      <button
        type="button" className="tn-pinnav-step" aria-label="Previous pin"
        onClick={() => flyTo(pinsStore.cycle(-1))} disabled={pins.length < 2}
      >◀</button>

      <button
        type="button" className="tn-pinnav-body" title="Fly to this pin"
        onClick={() => flyTo(active ?? pinsStore.cycle(1))}
      >
        <span className="tn-pinnav-count">📍 {idx >= 0 ? idx + 1 : "–"}/{pins.length}</span>
        <span className="tn-pinnav-label">{active ? active.label : "Select a pin"}</span>
      </button>

      <button
        type="button" className="tn-pinnav-step" aria-label="Next pin"
        onClick={() => flyTo(pinsStore.cycle(1))} disabled={pins.length < 2}
      >▶</button>

      <button
        type="button" className="tn-pinnav-del" aria-label="Remove this pin" title="Remove this pin"
        onClick={() => active && pinsStore.remove(active.id)} disabled={!active}
      >✕</button>

      {pins.length > 1 && (
        <button
          type="button" className="tn-pinnav-clear" title="Clear all pins"
          onClick={() => pinsStore.clear()}
        >Clear</button>
      )}
    </div>
  );
}
