// Pure roll-up aggregation: a category widget = the sources of one catalog `group`.
// Count = sum of known constituent counts; freshness = worst-of (a roll-up is only
// as fresh as its slowest source). node-tested.

import { catalogByGroup } from "@/lib/sources/catalog";
import { worseFresh, type FreshKind } from "@/lib/sources/freshKind";

export function constituentIds(group: string): string[] {
  const g = catalogByGroup().find((x) => x.group === group);
  return g ? g.sources.map((s) => s.id) : [];
}

export function rollupCount(counts: Record<string, number | undefined>, ids: string[]): number | null {
  let sum = 0;
  let any = false;
  for (const id of ids) {
    const c = counts[id];
    if (typeof c === "number") {
      sum += c;
      any = true;
    }
  }
  return any ? sum : null;
}

export function rollupFresh(states: FreshKind[]): FreshKind {
  if (states.length === 0) return "off";
  return states.reduce((acc, s) => worseFresh(acc, s));
}
