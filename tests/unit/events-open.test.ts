import { expect, test } from "vitest";
import { openEvent, zoomForPrecision } from "@/lib/events/openEvent";
import { mapViewStore, type PointView } from "@/lib/mapView";
import { overlay } from "@/lib/overlay";
import type { NormalizedEvent } from "@/lib/events/model";
import type { SignalFeature } from "@/lib/signals/types";

function ev(precision: NormalizedEvent["geo"]["precision"]): NormalizedEvent {
  return {
    id: "usgs:1", type: "quake", title: "M6.1 quake", place: { name: "Off coast" },
    geo: { lat: 12.3, lon: -45.6, precision },
    occurredAt: null, severity: { tier: "S3", raw: 6 },
    source: { id: "earthquakes", label: "Earthquakes (USGS)", attribution: "USGS" },
    color: "#b91c1c",
  };
}

test("zoomForPrecision tightens as precision improves", () => {
  expect(zoomForPrecision("EXACT")).toBeGreaterThan(zoomForPrecision("ADMIN"));
  expect(zoomForPrecision("ADMIN")).toBeGreaterThan(zoomForPrecision("COUNTRY_CENTROID"));
});

test("openEvent flies to the event coords with a precision-based zoom", () => {
  let got: PointView | null = null;
  mapViewStore.registerFlyToPoint((v) => { got = v; });
  overlay.close();
  openEvent(ev("EXACT")); // no raw feature → flies but no dossier
  expect(got).toEqual({ lat: 12.3, lon: -45.6, zoom: 6 });
  expect(overlay.get().object).toBe(null);
  mapViewStore.registerFlyToPoint(null);
});

test("openEvent opens the signal dossier when the raw feature is supplied", () => {
  mapViewStore.registerFlyToPoint(() => {});
  overlay.close();
  const f: SignalFeature = { id: "usgs:1", lat: 12.3, lon: -45.6, title: "M6.1 quake", signalId: "earthquakes" };
  openEvent(ev("EXACT"), f, "Earthquakes (USGS)");
  const obj = overlay.get().object;
  expect(obj?.id).toBe("usgs:1");
  expect(obj?.kind).toBe("signal");
  overlay.close();
  mapViewStore.registerFlyToPoint(null);
});
