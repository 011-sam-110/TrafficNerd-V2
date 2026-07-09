"use client";
// Operator ASSETS (points of interest) + proximity matching for the Disasters &
// Events feed. An operator drops their own sites (name + lat/lon, optionally a
// footprint radius) — persisted locally — and any event whose modelled impact
// radius reaches one is escalated from a "Global Event" to a **Direct Operational
// Threat**. Follows the lib/shell/watchlist idiom: PURE list ops + PURE proximity
// maths (unit-tested via direct import) wrapped by a thin persisted external store.
//
// Honesty: `impactRadiusKm` is a COARSE, documented hazard-footprint heuristic for
// proximity flagging — NOT an authoritative inundation/shaking model. It never
// fabricates per-event figures; it maps (type, tier, magnitude) to a radius band.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { haversineKm } from "@/lib/geo/haversine";
import type { NormalizedEvent, EventType, SeverityTier } from "@/lib/events/model";

export interface Asset {
  /** Stable id (dedupe / remove / config key). */
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Extra footprint buffer (km) added to the event's impact radius. Default 0. */
  radiusKm: number;
  createdAt: number;
}

export const ASSET_CAP = 50;

/** Tier → default impact radius (km) when a type has no better basis. */
const TIER_RADIUS: Record<SeverityTier, number> = { S0: 25, S1: 60, S2: 120, S3: 220, S4: 350 };

/** Quake felt/impact radius band by magnitude — coarse, documented. */
function quakeRadiusKm(mag: number | undefined): number {
  if (mag == null || !Number.isFinite(mag)) return 60;
  if (mag < 4) return 30;
  if (mag < 5) return 80;
  if (mag < 6) return 200;
  if (mag < 7) return 400;
  return 700;
}

const TYPE_TIER_RADIUS: Partial<Record<EventType, Record<SeverityTier, number>>> = {
  cyclone: { S0: 120, S1: 180, S2: 280, S3: 400, S4: 550 },
  flood: { S0: 30, S1: 60, S2: 120, S3: 200, S4: 300 },
  storm: { S0: 40, S1: 80, S2: 150, S3: 250, S4: 350 },
  volcano: { S0: 20, S1: 40, S2: 80, S3: 150, S4: 250 },
  disaster: { S0: 50, S1: 90, S2: 160, S3: 260, S4: 400 },
};

/** PURE: a coarse impact radius (km) for an event, from its type/tier/magnitude. */
export function impactRadiusKm(e: NormalizedEvent): number {
  if (e.type === "quake") return quakeRadiusKm(e.magnitude?.value);
  const byTier = TYPE_TIER_RADIUS[e.type];
  return (byTier ?? TIER_RADIUS)[e.severity.tier];
}

export interface Threat {
  assetId: string;
  assetName: string;
  /** Distance from the event anchor to the nearest intersecting asset. */
  distanceKm: number;
  /** The modelled impact radius used for the intersection test. */
  impactRadiusKm: number;
}

/**
 * PURE: for each event, the nearest asset its impact radius reaches (event impact
 * radius + that asset's footprint buffer). Events with no intersecting asset are
 * absent from the map. Deterministic: ties break toward the smaller distance, then
 * the lexicographically-smaller asset id.
 */
export function assessThreats(events: NormalizedEvent[], assets: Asset[]): Map<string, Threat> {
  const out = new Map<string, Threat>();
  if (assets.length === 0) return out;
  for (const e of events) {
    const reach = impactRadiusKm(e);
    let best: Threat | null = null;
    for (const a of assets) {
      const d = haversineKm(e.geo.lat, e.geo.lon, a.lat, a.lon);
      if (d > reach + (a.radiusKm || 0)) continue;
      if (
        !best ||
        d < best.distanceKm ||
        (d === best.distanceKm && a.id < best.assetId)
      ) {
        best = { assetId: a.id, assetName: a.name, distanceKm: d, impactRadiusKm: reach };
      }
    }
    if (best) out.set(e.id, best);
  }
  return out;
}

// --- PURE list ops (unit-tested) --------------------------------------------

/** Build a validated Asset, or null if the coords are out of range / name blank. */
export function makeAsset(name: string, lat: number, lon: number, radiusKm = 0, now = Date.now()): Asset | null {
  const nm = (name ?? "").trim();
  if (!nm) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  const r = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 0;
  return { id: `poi:${now}:${Math.round(lat * 1e4)}:${Math.round(lon * 1e4)}`, name: nm, lat, lon, radiusKm: r, createdAt: now };
}

/** Add an asset (replace same id), newest-first, capped. */
export function addAsset(list: Asset[], a: Asset, cap = ASSET_CAP): Asset[] {
  return [a, ...list.filter((x) => x.id !== a.id)].slice(0, cap);
}

export function removeAsset(list: Asset[], id: string): Asset[] {
  return list.filter((a) => a.id !== id);
}

/** Coerce a persisted blob into a clean Asset[] (drops malformed entries). */
export function coerceAssets(saved: unknown): Asset[] {
  if (!Array.isArray(saved)) return [];
  const out: Asset[] = [];
  for (const raw of saved) {
    const a = raw as Partial<Asset>;
    if (typeof a?.id !== "string" || typeof a?.name !== "string") continue;
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
    if ((a.lat as number) < -90 || (a.lat as number) > 90) continue;
    if ((a.lon as number) < -180 || (a.lon as number) > 180) continue;
    out.push({
      id: a.id,
      name: a.name,
      lat: a.lat as number,
      lon: a.lon as number,
      radiusKm: Number.isFinite(a.radiusKm) && (a.radiusKm as number) > 0 ? (a.radiusKm as number) : 0,
      createdAt: Number.isFinite(a.createdAt) ? (a.createdAt as number) : 0,
    });
  }
  return out.slice(0, ASSET_CAP);
}

// --- Persisted external store ------------------------------------------------

const PERSIST_KEY = "tn.events.assets.v1";
const PERSIST_VERSION = 1;

let state: Asset[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const assetsStore = {
  add(a: Asset) { state = addAsset(state, a); emit(); },
  remove(id: string) { state = removeAsset(state, id); emit(); },
  clear() { if (state.length === 0) return; state = []; emit(); },
  get(): Asset[] { return state; },
  hydrate() { state = coerceAssets(loadPersisted<Asset[]>(PERSIST_KEY, PERSIST_VERSION)); emit(); },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function useAssets(): Asset[] {
  return useSyncExternalStore(assetsStore.subscribe, assetsStore.get, assetsStore.get);
}
