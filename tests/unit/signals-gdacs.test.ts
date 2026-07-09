import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/gdacs-events.json";
import { normalizeGdacs, gdacsEventLabel, gdacsAlertColor } from "@/lib/signals/gdacs";

test("normalizes the GDACS multi-hazard FeatureCollection", () => {
  const out = normalizeGdacs(fixture as never);
  expect(out).toHaveLength(5); // FL, EQ, TC, WF, DR — all have coords + an event id
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["gdacs"]));

  const eq = out.find((f) => f.props?.hazard === "Earthquake");
  expect(eq).toBeDefined();
  expect(eq!.id).toMatch(/^gdacs:\d+:\d+$/);
  expect(eq!.title).toContain("Papua New Guinea");
  expect(eq!.color).toBe(gdacsAlertColor("Green"));
  expect(typeof eq!.ts).toBe("string"); // fromdate parsed as UTC
  expect(eq!.props?.country).toBe("Papua New Guinea");
});

test("skips features with missing/invalid coordinates", () => {
  const bad = { features: [{ geometry: { coordinates: [null, null] }, properties: { eventid: 1, eventtype: "EQ" } }] };
  expect(normalizeGdacs(bad as never)).toHaveLength(0);
});

test("dedupes repeated event+episode entries (GDACS lists the same event twice)", () => {
  const dup = {
    features: [
      { geometry: { coordinates: [10, 20] }, properties: { eventid: 42, episodeid: 3, eventtype: "TC", alertlevel: "Red" } },
      { geometry: { coordinates: [10, 20] }, properties: { eventid: 42, episodeid: 3, eventtype: "TC", alertlevel: "Red" } },
    ],
  };
  const out = normalizeGdacs(dup as never);
  expect(out).toHaveLength(1); // one id → one row (no duplicate React keys)
  expect(out[0].id).toBe("gdacs:42:3");
});

test("event-type labels and alert-level colours", () => {
  expect(gdacsEventLabel("TC")).toBe("Tropical cyclone");
  expect(gdacsEventLabel("WF")).toBe("Wildfire");
  expect(gdacsEventLabel("??")).toBe("Disaster");
  expect(gdacsAlertColor("Red")).toBe("#dc2626");
  expect(gdacsAlertColor("Orange")).toBe("#f59e0b");
  expect(gdacsAlertColor("Green")).toBe("#16a34a");
});

test("alertLevel maps to the expected magnitude (0–10 ramp)", () => {
  const make = (alertlevel: string) => ({
    features: [
      {
        geometry: { coordinates: [10, 20] },
        properties: { eventid: 1, episodeid: 1, eventtype: "EQ", alertlevel },
      },
    ],
  });
  expect(normalizeGdacs(make("Red") as never)[0].props?.magnitude).toBe(8);
  expect(normalizeGdacs(make("Orange") as never)[0].props?.magnitude).toBe(6);
  expect(normalizeGdacs(make("Green") as never)[0].props?.magnitude).toBe(3);
  expect(normalizeGdacs(make("Unknown") as never)[0].props?.magnitude).toBe(5);
});
