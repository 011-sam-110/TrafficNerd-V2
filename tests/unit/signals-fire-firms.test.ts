import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeFirms, fireColor } from "@/lib/signals/fire-firms";

const csv = readFileSync(new URL("../fixtures/firms-fires.csv", import.meta.url), "utf-8");

test("parses FIRMS CSV, skips bad coords, sorts by FRP, respects the cap", () => {
  const out = normalizeFirms(csv);
  expect(out).toHaveLength(6); // 6 valid rows; the empty lat/lon row is skipped
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["fire-active"]));
  // Sorted by intensity (FRP) — the 183.89 MW detection leads.
  expect(out[0].props?.frp).toBe("183.9 MW");
  expect(out[0].color).toBe(fireColor(183.89)); // #7f1d1d
  expect(out[0].props?.confidence).toBe("low"); // VIIRS "l"
  expect(out[0].ts).toBe("2026-06-27T05:21:00.000Z"); // acq_date + acq_time 521

  const cap2 = normalizeFirms(csv, 2);
  expect(cap2).toHaveLength(2);
});

test("confidence flags and the FRP colour ramp", () => {
  const out = normalizeFirms(csv);
  expect(out.some((f) => f.props?.confidence === "high")).toBe(true); // the "h" row
  expect(fireColor(120)).toBe("#7f1d1d");
  expect(fireColor(60)).toBe("#b91c1c");
  expect(fireColor(25)).toBe("#dc2626");
  expect(fireColor(8)).toBe("#ea580c");
  expect(fireColor(1)).toBe("#f97316");
});
