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
  it("gives the top INTEGER magnitude its own bucket (off-by-one guard)", () => {
    // [5,6] must render as two bars (5→1, 6→1), not one "5: 2" that swallows the max.
    const d = distribution([f({ props: { magnitude: 5 } }), f({ props: { magnitude: 6 } })]);
    expect(d.kind).toBe("magnitude");
    expect(d.bins.find((b) => b.label === "5")?.count).toBe(1);
    expect(d.bins.find((b) => b.label === "6")?.count).toBe(1);
    expect(d.bins.reduce((n, b) => n + b.count, 0)).toBe(2);
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
