import { describe, it, expect } from "vitest";
import type { SignalFeature } from "@/lib/signals/types";
import { projectSignal } from "@/lib/console/signals/signalCard";
import { WORLD_SCOPE, type Scope } from "@/lib/shell/scope";

const sf = (over: Partial<SignalFeature>): SignalFeature => ({
  id: "x", lat: 1, lon: 2, title: "T", signalId: "s", ...over,
});

describe("projectSignal", () => {
  it("ranks by magnitude desc when any feature carries one", () => {
    const r = projectSignal([
      sf({ id: "a", props: { magnitude: 4 } }),
      sf({ id: "b", props: { magnitude: 7 } }),
      sf({ id: "c", props: { magnitude: 5 } }),
    ], WORLD_SCOPE, {});
    expect(r.rows.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("ranks by recency desc when no feature has a magnitude (undated last)", () => {
    const r = projectSignal([
      sf({ id: "old", ts: "2026-06-20T00:00:00Z" }),
      sf({ id: "new", ts: "2026-06-28T00:00:00Z" }),
      sf({ id: "undated" }),
    ], WORLD_SCOPE, {});
    expect(r.rows.map((x) => x.id)).toEqual(["new", "old", "undated"]);
  });

  it("trims to the active scope and reports total vs shown", () => {
    const near: Scope = { mode: "region", center: { lat: 51.5, lon: -0.12 }, radiusKm: 50, label: "London" };
    const r = projectSignal([
      sf({ id: "in", lat: 51.51, lon: -0.13 }),
      sf({ id: "out", lat: 35, lon: 139 }),
    ], near, {});
    expect(r.rows.map((x) => x.id)).toEqual(["in"]);
    expect(r.total).toBe(2);
    expect(r.shown).toBe(1);
  });

  it("emits no alerts by default for a plain feed", () => {
    const r = projectSignal([
      sf({ id: "a", props: { magnitude: 9 } }),
    ], WORLD_SCOPE, {});
    expect(r.alerts).toEqual([]);
  });

  it("alerts on magnitude at/above alertMin, escalating to critical", () => {
    const r = projectSignal([
      sf({ id: "lo", title: "Quake A", props: { magnitude: 4 } }),
      sf({ id: "mid", title: "Quake B", props: { magnitude: 5.5 } }),
      sf({ id: "big", title: "Quake C", props: { magnitude: 8 } }),
    ], WORLD_SCOPE, { alertMin: 5 });
    const byRef = Object.fromEntries(r.alerts.map((a) => [a.ref, a.severity]));
    expect(byRef.lo).toBeUndefined();          // below floor
    expect(byRef.mid).toBe("warn");            // >= 5, < 7
    expect(byRef.big).toBe("critical");        // >= alertMin + 2
    expect(r.alerts[0].ref).toBe("big");       // critical sorts first
  });

  it("surfaces declared-severe features via alert-level props", () => {
    const r = projectSignal([
      sf({ id: "red", title: "GDACS storm", props: { alertlevel: "Red" } }),
      sf({ id: "green", title: "GDACS calm", props: { alertlevel: "Green" } }),
    ], WORLD_SCOPE, {});
    expect(r.alerts.map((a) => a.ref)).toEqual(["red"]);
    expect(r.alerts[0].severity).toBe("critical");
  });

  it("collapses a feature that trips both magnitude and prop severity into one alert", () => {
    const r = projectSignal([
      sf({ id: "dup", title: "Big severe", props: { magnitude: 9, severity: "extreme" } }),
    ], WORLD_SCOPE, { alertMin: 5 });
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].ref).toBe("dup");
    expect(r.alerts[0].severity).toBe("critical");
  });

  it("caps rows at the configured limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => sf({ id: `q${i}`, props: { magnitude: i } }));
    const r = projectSignal(many, WORLD_SCOPE, { limit: 10 });
    expect(r.rows).toHaveLength(10);
    expect(r.shown).toBe(80);
    expect(r.rows[0].magnitude).toBe(79); // highest first
  });
});
