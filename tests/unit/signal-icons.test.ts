import { describe, it, expect } from "vitest";
import {
  ICON_SVG,
  SIGNAL_ICON,
  SIGNAL_ICON_KEYS,
  signalIconKey,
} from "@/lib/icons/svg";
import { toSignalFC } from "@/lib/map/features";
import type { WorldObject } from "@/lib/world";

const sig = (over: Partial<WorldObject>): WorldObject => ({
  kind: "signal",
  id: "x",
  lat: 1,
  lon: 2,
  label: "T",
  meta: { signalId: "earthquakes", props: {} },
  ...over,
});

describe("signalIconKey", () => {
  it("maps a known source id to its pictogram", () => {
    expect(signalIconKey("earthquakes")).toBe("sig-quake");
    expect(signalIconKey("wildfires")).toBe("sig-fire");
    expect(signalIconKey("ais")).toBe("sig-ship");
  });

  it("resolves GDACS per-feature from its hazard prop", () => {
    expect(signalIconKey("gdacs", { hazard: "Tropical cyclone" })).toBe("sig-cyclone");
    expect(signalIconKey("gdacs", { hazard: "Flood" })).toBe("sig-flood");
    expect(signalIconKey("gdacs", { hazard: "Tsunami" })).toBe("sig-flood");
  });

  it("falls back to the generic pin for GDACS without/with an unknown hazard", () => {
    expect(signalIconKey("gdacs", {})).toBe("sig-generic");
    expect(signalIconKey("gdacs", { hazard: "Mystery" })).toBe("sig-generic");
  });

  it("falls back to the generic pin for an unregistered source", () => {
    expect(signalIconKey("not-a-real-source")).toBe("sig-generic");
  });
});

describe("signal icon catalogue integrity", () => {
  it("every mapped icon and every registered key has a pictogram", () => {
    for (const key of Object.values(SIGNAL_ICON)) {
      expect(ICON_SVG[key], `missing SVG for ${key}`).toBeTruthy();
    }
    for (const key of SIGNAL_ICON_KEYS) {
      expect(ICON_SVG[key], `missing SVG for ${key}`).toBeTruthy();
    }
  });

  it("registers every icon a mapping can produce (no unregistered sprite)", () => {
    const registered = new Set<string>(SIGNAL_ICON_KEYS);
    for (const key of Object.values(SIGNAL_ICON)) {
      expect(registered.has(key), `${key} mapped but not registered`).toBe(true);
    }
  });
});

describe("toSignalFC icon property", () => {
  it("attaches the resolved icon to each point feature", () => {
    const fc = toSignalFC([
      sig({ id: "q", meta: { signalId: "earthquakes", props: { magnitude: 6 } } }),
      sig({ id: "c", meta: { signalId: "gdacs", props: { hazard: "Volcano" } } }),
    ]);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties?.icon).toBe("sig-quake");
    expect(fc.features[1].properties?.icon).toBe("sig-volcano");
  });

  it("keeps magnitude-driven radius alongside the icon", () => {
    const fc = toSignalFC([sig({ meta: { signalId: "earthquakes", props: { magnitude: 5 } } })]);
    // 4 + 5*1.6 = 12
    expect(fc.features[0].properties?.radius).toBeCloseTo(12);
    expect(fc.features[0].properties?.icon).toBe("sig-quake");
  });
});
