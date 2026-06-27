import { expect, test } from "vitest";
import feodo from "@/tests/fixtures/feodo-c2.json";
import ransomware from "@/tests/fixtures/ransomware-victims.json";
import { normalizeFeodoC2, c2Color } from "@/lib/signals/cyber-c2";
import { normalizeRansomware, ransomwareColor } from "@/lib/signals/cyber-ransomware";
import { countMagnitude, groupByCountry, toNum } from "@/lib/signals/aggregate";
import { centroidByIso2 } from "@/lib/signals/country-centroids.data";

test("Feodo C2 aggregates by country, skipping rows with no/garbled country", () => {
  const out = normalizeFeodoC2(feodo as never);
  expect(out).toHaveLength(3); // US, GB, JP — the null-country row is skipped
  const us = out.find((f) => f.id === "cyber-c2:US")!;
  expect(us.props?.c2Servers).toBe(2);
  expect(us.props?.online).toBe(1); // 1 online (QakBot) + 1 offline (Emotet)
  expect(us.props?.offline).toBe(1);
  expect(us.props?.malware).toBe("Emotet, QakBot");
  // Marker sits at the country centroid.
  const ctr = centroidByIso2("US")!;
  expect(us.lat).toBe(ctr.lat);
  expect(us.lon).toBe(ctr.lon);
  expect(us.color).toBe(c2Color(2));
  expect(us.ts).toBeUndefined(); // snapshot, never time-filtered
});

test("Ransomware.live aggregates recent victims by country with gangs + sectors", () => {
  const out = normalizeRansomware(ransomware as never);
  expect(out).toHaveLength(6); // 6 distinct countries; the empty-country row is skipped
  const us = out.find((f) => f.id === "cyber-ransomware:US")!;
  expect(us.props?.victims).toBe(1);
  expect(us.props?.gangs).toBe("dragonforce");
  expect(us.props?.sectors).toBe("Technology");
  expect(us.color).toBe(ransomwareColor(1));
});

test("aggregate helpers: log-scaled magnitude, country grouping, numeric coercion", () => {
  expect(countMagnitude(0)).toBe(0);
  expect(countMagnitude(1)).toBe(2); // clamped up so a lone marker stays visible
  expect(countMagnitude(100)).toBeCloseTo(8, 1);
  expect(countMagnitude(10_000_000)).toBe(10); // clamped down

  const grouped = groupByCountry([{ c: "us" }, { c: "US" }, { c: "" }, { c: null }], (r) => r.c);
  expect(grouped.get("US")).toHaveLength(2); // case-folded, empties dropped
  expect(grouped.size).toBe(1);

  expect(toNum("0")).toBe(0);
  expect(toNum(1234)).toBe(1234);
  expect(toNum("-")).toBe(0);
});
