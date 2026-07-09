import { expect, test } from "vitest";
import {
  makeAsset,
  addAsset,
  removeAsset,
  coerceAssets,
  impactRadiusKm,
  assessThreats,
  ASSET_CAP,
  type Asset,
} from "@/lib/events/assets";
import type { NormalizedEvent, EventType, SeverityTier } from "@/lib/events/model";

function ev(id: string, lat: number, lon: number, opts: { type?: EventType; tier?: SeverityTier; mag?: number } = {}): NormalizedEvent {
  const e: NormalizedEvent = {
    id, type: opts.type ?? "quake", title: id, place: { name: id },
    geo: { lat, lon, precision: "EXACT" }, occurredAt: null,
    severity: { tier: opts.tier ?? "S3", raw: 6 },
    source: { id: "x", label: "X", attribution: "X" }, color: "#000",
  };
  if (opts.mag != null) e.magnitude = { value: opts.mag, unit: "M" };
  return e;
}

test("makeAsset validates name + coord ranges", () => {
  expect(makeAsset("", 10, 10)).toBe(null);
  expect(makeAsset("Port", 200, 10)).toBe(null);
  expect(makeAsset("Port", 10, 999)).toBe(null);
  const a = makeAsset("  Rotterdam  ", 51.95, 4.14, 30, 1000);
  expect(a).not.toBe(null);
  expect(a!.name).toBe("Rotterdam");
  expect(a!.radiusKm).toBe(30);
});

test("addAsset dedupes + caps; removeAsset drops one", () => {
  const a = makeAsset("A", 1, 1, 0, 1)!;
  const b = makeAsset("B", 2, 2, 0, 2)!;
  expect(addAsset(addAsset([], a), b).map((x) => x.name)).toEqual(["B", "A"]);
  // dedupe by id
  expect(addAsset([a], { ...a, name: "A2" }).length).toBe(1);
  expect(removeAsset([a, b], a.id).map((x) => x.name)).toEqual(["B"]);
  let list: Asset[] = [];
  for (let i = 0; i < ASSET_CAP + 5; i++) list = addAsset(list, makeAsset(`P${i}`, 0, i / 100, 0, i)!);
  expect(list.length).toBe(ASSET_CAP);
});

test("coerceAssets drops malformed persisted entries", () => {
  const clean = coerceAssets([
    { id: "1", name: "ok", lat: 10, lon: 10, radiusKm: 5, createdAt: 1 },
    { id: "2", name: "bad-lat", lat: 999, lon: 0 },
    { name: "no-id", lat: 0, lon: 0 },
    "garbage",
  ]);
  expect(clean.map((a) => a.id)).toEqual(["1"]);
  expect(coerceAssets(null)).toEqual([]);
});

test("impactRadiusKm bands by magnitude (quake) and tier (others)", () => {
  expect(impactRadiusKm(ev("q1", 0, 0, { type: "quake", mag: 3.5 }))).toBe(30);
  expect(impactRadiusKm(ev("q2", 0, 0, { type: "quake", mag: 6.2 }))).toBe(400);
  expect(impactRadiusKm(ev("q3", 0, 0, { type: "quake" }))).toBe(60); // no magnitude → default band
  // cyclone S4 uses the cyclone tier table (larger footprint than a generic disaster).
  expect(impactRadiusKm(ev("c", 0, 0, { type: "cyclone", tier: "S4" }))).toBe(550);
});

test("assessThreats flags events reaching an asset and picks the nearest", () => {
  const assets: Asset[] = [
    makeAsset("Near", 35.70, 139.70, 0, 1)!,   // ~2 km from the Tokyo quake
    makeAsset("Mid", 36.10, 139.70, 0, 2)!,     // ~47 km
  ];
  // M6 quake at Tokyo → 400 km reach → both assets intersect; nearest = "Near".
  const t = assessThreats([ev("quake", 35.68, 139.69, { type: "quake", mag: 6 })], assets);
  expect(t.has("quake")).toBe(true);
  expect(t.get("quake")!.assetName).toBe("Near");
  expect(t.get("quake")!.impactRadiusKm).toBe(400);

  // No assets → no threats.
  expect(assessThreats([ev("quake", 35.68, 139.69, { mag: 6 })], []).size).toBe(0);

  // A distant asset (London) is out of a M4 quake's 80 km reach.
  const far = assessThreats(
    [ev("small", 35.68, 139.69, { type: "quake", mag: 4 })],
    [makeAsset("London", 51.5, -0.12, 0, 3)!],
  );
  expect(far.size).toBe(0);
});

test("assessThreats honours the per-asset footprint buffer", () => {
  const evt = ev("small", 35.68, 139.69, { type: "quake", mag: 4 }); // 80 km reach
  const at100 = makeAsset("Site", 36.58, 139.69, 0, 1)!;             // ~100 km north
  expect(assessThreats([evt], [at100]).size).toBe(0);               // 80 < 100 → clear
  const buffered = makeAsset("Site", 36.58, 139.69, 50, 1)!;         // +50 km footprint
  expect(assessThreats([evt], [buffered]).size).toBe(1);            // 130 ≥ 100 → threat
});
