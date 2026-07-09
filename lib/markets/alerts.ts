"use client";
// Local price alerts for the Markets focus chart. Persisted to localStorage (no
// account, no server) — the user arms the bell, clicks a price on the chart, and
// gets a browser Notification when the live quote crosses it. The crossing test is
// a pure, unit-tested function; everything else is thin persistence + the Web
// Notification API (permission-gated, dormant-safe when denied/unsupported).
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export type AlertDir = "above" | "below";
export interface PriceAlert {
  id: string;
  rowId: string;    // MarketRow.id this alert watches
  symbol: string;
  name: string;
  price: number;
  dir: AlertDir;
  createdAt: number;
}

const KEY = "tn.mkalerts.v1";
const VERSION = 1;
const CAP = 60;

export function loadAlerts(): PriceAlert[] {
  return loadPersisted<PriceAlert[]>(KEY, VERSION) ?? [];
}
function save(list: PriceAlert[]): void {
  savePersisted(KEY, VERSION, list.slice(-CAP));
}

/** Add an alert (deduped by row+direction+price); returns the new list. */
export function addAlert(a: { rowId: string; symbol: string; name: string; price: number; dir: AlertDir; createdAt: number }): PriceAlert[] {
  const list = loadAlerts();
  const id = `${a.rowId}:${a.dir}:${Math.round(a.price * 1e6)}`;
  if (!list.some((x) => x.id === id)) list.push({ ...a, id });
  save(list);
  return loadAlerts();
}
export function removeAlert(id: string): PriceAlert[] {
  const list = loadAlerts().filter((a) => a.id !== id);
  save(list);
  return list;
}

/** Pure: did `cur` cross the alert threshold relative to the previous quote?
 *  Direction-aware and edge-triggered — only the transition fires, not every
 *  tick that stays beyond the level. Returns false without a prior sample. */
export function crossed(alert: { price: number; dir: AlertDir }, prev: number | undefined, cur: number): boolean {
  if (prev == null || !Number.isFinite(prev) || !Number.isFinite(cur)) return false;
  return alert.dir === "above" ? prev < alert.price && cur >= alert.price : prev > alert.price && cur <= alert.price;
}
