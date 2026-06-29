import { expect, test } from "vitest";
import { aviationAlerts, type PlaneLite } from "@/lib/console/widgets/aviation.rules";

const planes: PlaneLite[] = [
  { callsign: "AF23", squawk: "7700" },
  { callsign: "BA117", squawk: "2200" },
  { callsign: "RCH804", squawk: "1234", isMilitary: true },
  { callsign: "UA90", squawk: "7600" },
];

test("flags emergency squawks 7500/7600/7700 as critical", () => {
  const a = aviationAlerts(planes, {});
  const crit = a.filter((x) => x.severity === "critical").map((x) => x.ref);
  expect(crit.sort()).toEqual(["AF23", "UA90"]);
});

test("flags military entry as info", () => {
  const a = aviationAlerts(planes, {});
  expect(a.find((x) => x.ref === "RCH804")?.severity).toBe("info");
});

test("clean traffic produces no alerts", () => {
  expect(aviationAlerts([{ callsign: "X", squawk: "1000" }], {})).toEqual([]);
});
