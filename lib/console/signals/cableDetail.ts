// Pure projection + filtering for the CABLE ASSET focus view. Turns the generic
// SignalFeature[] (as produced by lib/signals/cables.ts) into typed asset rows,
// derives the filter option lists, and applies the Status / Owner / Region filter
// and column sort. Kept DOM-free + unit-tested so the React shell stays dumb.

import type { SignalFeature } from "@/lib/signals/types";
import { REGION_ORDER } from "@/lib/signals/cable-regions";

export interface CableAsset {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: string; // "Operational" | "Planned" | "—"
  rfsYear: number | null;
  lengthKm: number | null;
  lengthLabel: string;
  capacity: string; // "—" — not published by the source
  owners: string;
  suppliers: string;
  region: string;
  landings: string;
  landingCount: number;
  countries: string;
  link?: string;
  feature: SignalFeature;
}

function str(v: unknown, fallback = "—"): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pure: one cable SignalFeature → a typed asset row. */
export function toCableAsset(f: SignalFeature): CableAsset {
  const p = f.props ?? {};
  return {
    id: f.id,
    name: f.title,
    lat: f.lat,
    lon: f.lon,
    status: str(p.status),
    rfsYear: num(p.rfsYear),
    lengthKm: num(p.lengthKm),
    lengthLabel: str(p.length),
    capacity: str(p.capacity),
    owners: str(p.owners),
    suppliers: str(p.suppliers),
    region: str(p.region, "Unclassified"),
    landings: str(p.landings),
    landingCount: num(p.landingPoints) ?? 0,
    countries: str(p.countries),
    link: f.link,
    feature: f,
  };
}

export function cableAssets(features: SignalFeature[]): CableAsset[] {
  return features.map(toCableAsset);
}

// ── Filter option lists (only values actually present — no dead options) ─────

export function statusOptions(rows: CableAsset[]): string[] {
  const order = ["Operational", "Planned", "—"];
  const present = new Set(rows.map((r) => r.status));
  return order.filter((s) => present.has(s));
}

export function regionOptions(rows: CableAsset[]): string[] {
  const present = new Set(rows.map((r) => r.region));
  return REGION_ORDER.filter((r) => present.has(r));
}

/** Distinct operator/owner names split out of the comma-separated consortium strings. */
export function ownerOptions(rows: CableAsset[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.owners === "—") continue;
    for (const owner of r.owners.split(",").map((s) => s.trim()).filter(Boolean)) {
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([o]) => o);
}

export interface CableFilter {
  status: string; // "" = any
  region: string; // "" = any
  owner: string; // free-text or exact owner; "" = any
}

export const EMPTY_FILTER: CableFilter = { status: "", region: "", owner: "" };

/** Pure: apply Status / Region / Owner filters. Owner match is case-insensitive substring. */
export function filterCables(rows: CableAsset[], filter: CableFilter): CableAsset[] {
  const owner = filter.owner.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.region && r.region !== filter.region) return false;
    if (owner && !r.owners.toLowerCase().includes(owner)) return false;
    return true;
  });
}

export type CableSortKey = "name" | "rfsYear" | "lengthKm" | "capacity" | "owners" | "status";

/** Pure: sort asset rows. Missing numerics sort last regardless of direction. */
export function sortCables(rows: CableAsset[], key: CableSortKey, dir: 1 | -1): CableAsset[] {
  const numOr = (n: number | null) => (n == null ? (dir === 1 ? Infinity : -Infinity) : n);
  const cmp = (a: CableAsset, b: CableAsset): number => {
    switch (key) {
      case "rfsYear":
        return numOr(a.rfsYear) - numOr(b.rfsYear);
      case "lengthKm":
        return numOr(a.lengthKm) - numOr(b.lengthKm);
      case "owners":
        return a.owners.localeCompare(b.owners);
      case "status":
        return a.status.localeCompare(b.status);
      case "capacity":
        return a.capacity.localeCompare(b.capacity);
      case "name":
      default:
        return a.name.localeCompare(b.name);
    }
  };
  return [...rows].sort((a, b) => dir * cmp(a, b));
}

export interface CableSummary {
  total: number;
  operational: number;
  planned: number;
  totalLengthKm: number; // sum of known lengths
  knownLength: number; // how many rows contributed a length
  regions: { region: string; count: number }[];
}

/** Pure: headline asset stats for the summary strip (replaces the event histograms). */
export function summarize(rows: CableAsset[]): CableSummary {
  let operational = 0,
    planned = 0,
    totalLengthKm = 0,
    knownLength = 0;
  const regions = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "Operational") operational++;
    else if (r.status === "Planned") planned++;
    if (r.lengthKm != null) {
      totalLengthKm += r.lengthKm;
      knownLength++;
    }
    regions.set(r.region, (regions.get(r.region) ?? 0) + 1);
  }
  const regionRows = REGION_ORDER.filter((rg) => regions.has(rg)).map((rg) => ({ region: rg, count: regions.get(rg)! }));
  return { total: rows.length, operational, planned, totalLengthKm, knownLength, regions: regionRows };
}

// ── Landing-station asset rows (the second cable asset layer) ────────────────

export interface LandingAsset {
  id: string;
  name: string;
  lat: number;
  lon: number;
  cableCount: number;
  cables: string;
  link?: string;
  feature: SignalFeature;
}

export function toLandingAsset(f: SignalFeature): LandingAsset {
  const p = f.props ?? {};
  return {
    id: f.id,
    name: f.title,
    lat: f.lat,
    lon: f.lon,
    cableCount: num(p.cableCount) ?? 0,
    cables: str(p.cables),
    link: f.link,
    feature: f,
  };
}

export function landingAssets(features: SignalFeature[]): LandingAsset[] {
  return features.map(toLandingAsset);
}

/** Pure: filter landings by a name/cable substring query. */
export function filterLandings(rows: LandingAsset[], query: string): LandingAsset[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(q) || r.cables.toLowerCase().includes(q));
}

/** Pure: sort landings by hub size (cable count) then name, or by name. */
export function sortLandings(rows: LandingAsset[], key: "cableCount" | "name", dir: 1 | -1): LandingAsset[] {
  const cmp = (a: LandingAsset, b: LandingAsset): number =>
    key === "cableCount" ? a.cableCount - b.cableCount || a.name.localeCompare(b.name) : a.name.localeCompare(b.name);
  return [...rows].sort((a, b) => dir * cmp(a, b));
}
