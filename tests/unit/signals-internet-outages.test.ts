import { expect, test } from "vitest";
// Live-captured IODA country-summary rows + one unknown-country edge row.
import fixture from "@/tests/fixtures/ioda-outages.json";
import { normalizeOutages, INTERNET_OUTAGES_SOURCE } from "@/lib/signals/internet-outages";
import { rowMetric } from "@/lib/console/signals/signalCard";

test("normalizes IODA outages to one marker per located country", () => {
  const out = normalizeOutages(fixture as never);
  // BZ, GI, LR resolve to centroids; the "ZZ" edge row has no centroid and is skipped.
  expect(out).toHaveLength(3);
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["internet-outages"]));
  expect(out.every((f) => f.id.startsWith("ioda:"))).toBe(true);
});

test("severity bands and magnitude scale with the outage score", () => {
  const out = normalizeOutages(fixture as never);
  const belize = out.find((f) => f.id === "ioda:BZ")!; // score ~377k → severe
  expect(belize.props?.severity).toBe("severe");
  expect(belize.title).toContain("Belize");

  const liberia = out.find((f) => f.id === "ioda:LR")!; // score 1500 → localised
  expect(liberia.props?.severity).toBe("localised");

  // Bigger outage → bigger marker.
  expect(Number(belize.props?.magnitude)).toBeGreaterThan(Number(liberia.props?.magnitude));
  expect(Number(belize.props?.magnitude)).toBeLessThanOrEqual(10);
});

test("declares the real outage score as its metric and rowMetric resolves it", () => {
  const out = normalizeOutages(fixture as never);
  const belize = out.find((f) => f.id === "ioda:BZ")!;

  // The metric points at a REAL finite numeric prop, not the log-radius proxy.
  expect(INTERNET_OUTAGES_SOURCE.metric).toEqual({ field: "outageScore", domain: [0, 100_000] });
  expect(typeof belize.props?.outageScore).toBe("number");
  expect(Number.isFinite(belize.props?.outageScore as number)).toBe(true);

  const resolved = rowMetric(belize, INTERNET_OUTAGES_SOURCE.metric);
  expect(resolved).toBeDefined();
  expect(resolved!.value).toBe(377786); // Math.round(scores.overall)
  expect(resolved!.domain).toEqual([0, 100_000]);
});
