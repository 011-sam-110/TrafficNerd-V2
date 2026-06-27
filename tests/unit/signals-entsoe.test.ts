import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseLatestLoad,
  parseZoneEic,
  normalizeGridLoad,
  loadFeature,
} from "@/lib/signals/entsoe";
import { zoneByEic } from "@/lib/signals/entsoe-zones.data";

const xml = readFileSync(fileURLToPath(new URL("../fixtures/entsoe-load.xml", import.meta.url)), "utf8");

test("parses the most recent load point from a GL_MarketDocument", () => {
  // Four points; the last (53890 MW) is the latest.
  expect(parseLatestLoad(xml)).toBe(53890);
  expect(parseZoneEic(xml)).toBe("10YFR-RTE------C");
});

test("parser is robust to empty/garbage input", () => {
  expect(parseLatestLoad("")).toBeNull();
  expect(parseLatestLoad("<GL_MarketDocument></GL_MarketDocument>")).toBeNull();
  expect(parseZoneEic("<x/>")).toBeNull();
});

test("builds one marker per zone with a real reading, skipping nulls", () => {
  const out = normalizeGridLoad([
    { eic: "10YFR-RTE------C", mw: 53890 },
    { eic: "10Y1001A1001A83F", mw: 61000 }, // Germany
    { eic: "10YFI-1--------U", mw: null }, // no reading → skipped
    { eic: "UNKNOWN-ZONE", mw: 1000 }, // not in the zone table → skipped
  ]);
  expect(out).toHaveLength(2);
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["grid-load"]));

  const fr = out.find((f) => f.id === "entsoe:10YFR-RTE------C")!;
  expect(fr.title).toContain("France");
  expect(fr.title).toContain("53.9 GW");
  expect(fr.props?.load).toBe("53,890 MW");
  // Bigger load → bigger marker.
  const de = out.find((f) => f.id === "entsoe:10Y1001A1001A83F")!;
  expect(Number(de.props?.magnitude)).toBeGreaterThanOrEqual(Number(fr.props?.magnitude));
});

test("loadFeature anchors at the zone coordinate", () => {
  const zone = zoneByEic("10YGB----------A")!;
  const f = loadFeature(zone, 38000);
  expect(f.lat).toBe(zone.lat);
  expect(f.lon).toBe(zone.lon);
  expect(f.title).toContain("Great Britain");
});
