import { expect, test } from "vitest";
import { runAlertRule, topSeverity, type Alert } from "@/lib/console/alerts";

test("runAlertRule passes through results", () => {
  const rule = (xs: number[]): Alert[] => xs.filter((n) => n > 5).map((n) => ({ id: `a${n}`, severity: "warn", text: `${n}` }));
  expect(runAlertRule(rule, [1, 9], {}).map((a) => a.id)).toEqual(["a9"]);
});

test("runAlertRule swallows rule errors", () => {
  const boom = () => { throw new Error("bad data"); };
  expect(runAlertRule(boom, [], {})).toEqual([]);
});

test("topSeverity ranks critical > warn > info", () => {
  expect(topSeverity([{ id: "1", severity: "info", text: "" }, { id: "2", severity: "critical", text: "" }])).toBe("critical");
  expect(topSeverity([])).toBeNull();
});
