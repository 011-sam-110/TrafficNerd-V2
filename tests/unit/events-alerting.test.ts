import { expect, test } from "vitest";
import { matchAlerts, coerceAlertRule, DEFAULT_ALERT_RULE, type AlertRuleConfig } from "@/lib/events/alerting";
import { makeAsset, type Asset } from "@/lib/events/assets";
import type { NormalizedEvent, EventType, SeverityTier } from "@/lib/events/model";

function ev(id: string, lat: number, lon: number, opts: { type?: EventType; tier?: SeverityTier } = {}): NormalizedEvent {
  return {
    id, type: opts.type ?? "quake", title: id, place: { name: id },
    geo: { lat, lon, precision: "EXACT" }, occurredAt: null,
    severity: { tier: opts.tier ?? "S3", raw: 6 },
    source: { id: "x", label: "X", attribution: "X" }, color: "#000",
  };
}

const rule = (over: Partial<AlertRuleConfig> = {}): AlertRuleConfig => ({ enabled: true, minTier: "S3", types: null, radiusKm: 300, ...over });
const asset: Asset = makeAsset("Tokyo Site", 35.70, 139.70, 0, 1)!;

test("matchAlerts is inert when disabled or when there are no assets", () => {
  expect(matchAlerts([ev("a", 35.68, 139.69)], [asset], rule({ enabled: false }), new Set())).toEqual([]);
  expect(matchAlerts([ev("a", 35.68, 139.69)], [], rule(), new Set())).toEqual([]);
});

test("matchAlerts fires for a new in-range event and picks the nearest asset", () => {
  const assets = [asset, makeAsset("Far", 36.5, 139.7, 0, 2)!];
  const hits = matchAlerts([ev("q", 35.68, 139.69)], assets, rule(), new Set());
  expect(hits.length).toBe(1);
  expect(hits[0].assetName).toBe("Tokyo Site");
  expect(hits[0].eventId).toBe("q");
});

test("matchAlerts respects tier, type, radius and the fired set", () => {
  // Below tier
  expect(matchAlerts([ev("a", 35.68, 139.69, { tier: "S2" })], [asset], rule({ minTier: "S3" }), new Set())).toEqual([]);
  // Wrong type
  expect(matchAlerts([ev("a", 35.68, 139.69, { type: "quake" })], [asset], rule({ types: ["cyclone"] }), new Set())).toEqual([]);
  // Out of radius (London is far from a Tokyo asset)
  expect(matchAlerts([ev("a", 51.5, -0.12)], [asset], rule({ radiusKm: 200 }), new Set())).toEqual([]);
  // Already fired → skipped
  expect(matchAlerts([ev("a", 35.68, 139.69)], [asset], rule(), new Set(["a"]))).toEqual([]);
});

test("coerceAlertRule fills defaults for junk", () => {
  expect(coerceAlertRule(null)).toEqual(DEFAULT_ALERT_RULE);
  expect(coerceAlertRule({ enabled: true, minTier: "S1", radiusKm: 50, types: ["quake"] })).toEqual({
    enabled: true, minTier: "S1", radiusKm: 50, types: ["quake"],
  });
  expect(coerceAlertRule({ minTier: "bogus", radiusKm: -3 })).toEqual({
    enabled: false, minTier: DEFAULT_ALERT_RULE.minTier, radiusKm: DEFAULT_ALERT_RULE.radiusKm, types: null,
  });
});
