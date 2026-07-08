import { describe, it, expect } from "vitest";
import { distribution, timeModel, sortFeatures } from "@/lib/console/signals/signalDetail";
import type { SignalFeature } from "@/lib/signals/types";

const f = (over: Partial<SignalFeature>): SignalFeature =>
  ({ id: "x", lat: 0, lon: 0, title: "t", signalId: "s", ...over });

describe("distribution", () => {
  it("uses a magnitude histogram when numeric magnitudes exist", () => {
    const d = distribution([f({ props: { magnitude: 2 } }), f({ props: { magnitude: 6 } })]);
    expect(d.kind).toBe("magnitude");
    expect(d.bins.reduce((n, b) => n + b.count, 0)).toBe(2);
  });
  it("falls back to declared severity when no magnitudes", () => {
    const d = distribution([f({ props: { alertLevel: "Red" } }), f({ props: { severity: "warning" } })]);
    expect(d.kind).toBe("severity");
    expect(d.bins.find((b) => b.label === "Severe")!.count).toBe(1);
  });
  it("is 'none' when neither magnitude nor severity exists (honest hide)", () => {
    expect(distribution([f({ props: { note: "hi" } })]).kind).toBe("none");
  });
});

describe("timeModel", () => {
  it("splits dated from undated", () => {
    const m = timeModel([f({ ts: "2026-07-08T00:00:00Z" }), f({})]);
    expect(m.values.length).toBe(1);
    expect(m.undated).toBe(1);
  });
});

describe("sortFeatures", () => {
  it("sorts by magnitude descending with dir -1", () => {
    const out = sortFeatures([f({ id: "a", props: { magnitude: 1 } }), f({ id: "b", props: { magnitude: 9 } })], "magnitude", -1);
    expect(out[0].id).toBe("b");
  });
});
