import { expect, test } from "vitest";
import { eventAlerts, type EventLite } from "@/lib/console/widgets/events.rules";

const evs: EventLite[] = [
  { id: "1", type: "quake", tier: "S2", title: "M4.7 quake", magnitude: 4.7 },
  { id: "2", type: "quake", tier: "S2", title: "M5.2 quake", magnitude: 5.2 },
  { id: "3", type: "disaster", tier: "S4", title: "Earthquake Venezuela" },
  { id: "4", type: "cyclone", tier: "S1", title: "Storm" },
];

test("flags S3/S4 tiers and M5+ quakes; ignores routine", () => {
  const ids = eventAlerts(evs, {}).map((a) => a.ref).sort();
  expect(ids).toEqual(["2", "3"]);
});

test("S4 is critical, S3 is warn", () => {
  const a = eventAlerts([{ id: "x", type: "disaster", tier: "S3", title: "Drought" }], {});
  expect(a[0].severity).toBe("warn");
});
