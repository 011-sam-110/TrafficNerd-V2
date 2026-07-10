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

const jets = (n: number, onGround = false): PlaneLite[] =>
  Array.from({ length: n }, (_, i) => ({ callsign: `NJE${i}`, isBizjet: true, onGround }));

test("fires ONE private-jet surge alert when the airborne count crosses the threshold", () => {
  const a = aviationAlerts(jets(5), { jetSurgeMin: 5 });
  const surge = a.filter((x) => x.ref === "jet-surge");
  expect(surge).toHaveLength(1);
  expect(surge[0].severity).toBe("warn");
  expect(surge[0].text).toContain("5 private jets");
});

test("no surge alert below the threshold, when unset, or when jets are grounded", () => {
  expect(aviationAlerts(jets(4), { jetSurgeMin: 5 }).some((x) => x.ref === "jet-surge")).toBe(false);
  expect(aviationAlerts(jets(9), {}).some((x) => x.ref === "jet-surge")).toBe(false); // opt-in
  expect(aviationAlerts(jets(9, true), { jetSurgeMin: 5 }).some((x) => x.ref === "jet-surge")).toBe(false);
});
