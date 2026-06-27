import { afterEach, expect, test } from "vitest";
import {
  MONITORS,
  ALL_LAYER_KEYS,
  monitorById,
  monitorLayerState,
  monitorSignalState,
  matchMonitor,
  applyMonitor,
} from "@/lib/monitors";
import { layersStore } from "@/lib/layers";
import { signalsStore } from "@/lib/signals/store";
import { SIGNALS } from "@/lib/signals/registry";

// Both stores are module singletons; reset to a known baseline after each test.
afterEach(() => {
  layersStore.applyPreset("all");
  for (const s of SIGNALS) signalsStore.set(s.id, false);
});

const SIGNAL_IDS = SIGNALS.map((s) => s.id);

test("every monitor references only real layer + signal ids", () => {
  const ids = new Set(SIGNAL_IDS);
  for (const m of MONITORS) {
    for (const k of m.layers) expect(ALL_LAYER_KEYS).toContain(k);
    for (const sig of m.signals) expect(ids.has(sig)).toBe(true);
  }
});

test("monitor ids are unique", () => {
  expect(new Set(MONITORS.map((m) => m.id)).size).toBe(MONITORS.length);
});

test("monitorLayerState turns the listed layers on, everything else off", () => {
  const ground = monitorById("ground")!;
  const ls = monitorLayerState(ground);
  expect(ls.cameras).toBe(true);
  expect(ls.webcams).toBe(true);
  expect(ls.planes).toBe(false);
  expect(ls.satellites).toBe(false);
  expect(ls.ships).toBe(false);
  expect(ls.weather).toBe(false);
});

test("monitorSignalState maps the universe to on/off", () => {
  const nature = monitorById("nature")!;
  const ss = monitorSignalState(nature, ["earthquakes", "wildfires", "cables", "conflict"]);
  expect(ss).toEqual({ earthquakes: true, wildfires: true, cables: false, conflict: false });
});

test("Calm = cameras only, no signals", () => {
  const calm = monitorById("calm")!;
  expect(calm.layers).toEqual(["cameras"]);
  expect(calm.signals).toEqual([]);
});

test("applyMonitor drives BOTH the layer and signal stores", () => {
  applyMonitor("skywatch");
  const ls = layersStore.get();
  expect(ls.planes).toBe(true);
  expect(ls.satellites).toBe(true);
  expect(ls.cameras).toBe(false);
  expect(signalsStore.isOn("launches")).toBe(true);
  expect(signalsStore.isOn("aurora")).toBe(true);
  expect(signalsStore.isOn("earthquakes")).toBe(false);
});

test("applyMonitor returns false for an unknown id (and changes nothing it shouldn't)", () => {
  expect(applyMonitor("does-not-exist")).toBe(false);
});

test("matchMonitor round-trips: after applyMonitor, the live state matches that monitor", () => {
  applyMonitor("nature");
  const id = matchMonitor(layersStore.get(), signalsStore.get(), SIGNAL_IDS);
  expect(id).toBe("nature");
});

test("matchMonitor returns null when the state matches no monitor", () => {
  layersStore.applyPreset("all"); // cameras+planes+satellites, no signals → not a monitor combo
  for (const s of SIGNALS) signalsStore.set(s.id, false);
  signalsStore.set(SIGNALS[0].id, true); // one stray signal on
  expect(matchMonitor(layersStore.get(), signalsStore.get(), SIGNAL_IDS)).toBeNull();
});
