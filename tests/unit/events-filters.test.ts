import { expect, test } from "vitest";
import {
  passesFilters,
  applyEventFilters,
  readFilters,
  toggleAllowSet,
  isAllowed,
  filtersActive,
  DEFAULT_FILTERS,
  type EventFilters,
} from "@/lib/events/filters";
import type { NormalizedEvent, EventType, SeverityTier } from "@/lib/events/model";

function ev(
  id: string,
  opts: { type?: EventType; tier?: SeverityTier; mag?: number; lat?: number; lon?: number } = {},
): NormalizedEvent {
  const e: NormalizedEvent = {
    id, type: opts.type ?? "quake", title: id, place: { name: id },
    geo: { lat: opts.lat ?? 35.68, lon: opts.lon ?? 139.69, precision: "EXACT" }, // Tokyo → asia
    occurredAt: null, severity: { tier: opts.tier ?? "S2", raw: 5 },
    source: { id: "x", label: "X", attribution: "X" }, color: "#000",
  };
  if (opts.mag != null) e.magnitude = { value: opts.mag, unit: "M" };
  return e;
}

const F = (over: Partial<EventFilters> = {}): EventFilters => ({ ...DEFAULT_FILTERS, minTier: "S0", ...over });

test("min severity hides lower tiers", () => {
  expect(passesFilters(ev("a", { tier: "S1" }), F({ minTier: "S2" }))).toBe(false);
  expect(passesFilters(ev("a", { tier: "S3" }), F({ minTier: "S2" }))).toBe(true);
});

test("min quake magnitude only affects quakes with a known magnitude", () => {
  expect(passesFilters(ev("q", { type: "quake", mag: 4.2 }), F({ minQuakeMag: 5 }))).toBe(false);
  expect(passesFilters(ev("q", { type: "quake", mag: 6.1 }), F({ minQuakeMag: 5 }))).toBe(true);
  // A cyclone is untouched by the quake-magnitude floor.
  expect(passesFilters(ev("c", { type: "cyclone" }), F({ minQuakeMag: 5 }))).toBe(true);
  // A quake with no magnitude value is not hidden (we never guess).
  expect(passesFilters(ev("q2", { type: "quake" }), F({ minQuakeMag: 5 }))).toBe(true);
});

test("type + region allow-sets", () => {
  expect(passesFilters(ev("q", { type: "quake" }), F({ types: ["cyclone"] }))).toBe(false);
  expect(passesFilters(ev("q", { type: "quake" }), F({ types: ["quake"] }))).toBe(true);
  // Tokyo is 'asia'; a region set without asia hides it.
  expect(passesFilters(ev("q"), F({ regions: ["eu"] }))).toBe(false);
  expect(passesFilters(ev("q"), F({ regions: ["asia"] }))).toBe(true);
});

test("applyEventFilters reports an honest hidden count", () => {
  const rows = [
    ev("a", { tier: "S1" }),
    ev("b", { tier: "S3" }),
    ev("c", { tier: "S4" }),
  ];
  const { rows: kept, hidden } = applyEventFilters(rows, F({ minTier: "S3" }));
  expect(kept.map((e) => e.id)).toEqual(["b", "c"]);
  expect(hidden).toBe(1);
});

test("readFilters coerces junk to safe defaults and honours minTier fallback", () => {
  expect(readFilters({})).toEqual(DEFAULT_FILTERS);
  expect(readFilters({ minTier: "S3" }).minTier).toBe("S3"); // legacy key fallback
  expect(readFilters({ evMinTier: "S2", minTier: "S3" }).minTier).toBe("S2"); // new key wins
  expect(readFilters({ evMinQuakeMag: -4 }).minQuakeMag).toBe(0);
  expect(readFilters({ evMinQuakeMag: 5.5 }).minQuakeMag).toBe(5.5);
  expect(readFilters({ evTypes: "quake" }).types).toBe(null); // non-array → all
  expect(readFilters({ evTypes: ["quake", "junk"] }).types).toEqual(["quake"]);
  expect(readFilters({ evRegions: ["asia", "nope"] }).regions).toEqual(["asia"]);
});

test("toggleAllowSet toggles membership and collapses to null at full coverage", () => {
  const universe: EventType[] = ["quake", "cyclone", "disaster"];
  // From "all" (null), deselect one → explicit remaining set.
  expect(toggleAllowSet<EventType>(null, "quake", universe)).toEqual(["cyclone", "disaster"]);
  // Re-selecting to full coverage collapses back to null.
  expect(toggleAllowSet<EventType>(["cyclone", "disaster"], "quake", universe)).toBe(null);
  // Deselect the last remaining → empty set (a real "hide all" state, not null).
  expect(toggleAllowSet<EventType>(["quake"], "quake", universe)).toEqual([]);
});

test("isAllowed + filtersActive", () => {
  expect(isAllowed(null, "quake")).toBe(true);
  expect(isAllowed(["cyclone"], "quake")).toBe(false);
  expect(filtersActive(DEFAULT_FILTERS)).toBe(true); // default minTier S1 is a filter
  expect(filtersActive(F())).toBe(false); // S0 + no others = inert
});
