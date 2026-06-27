import { describe, it, expect } from "vitest";
import { resolveSignals } from "@/lib/variants/resolveSignals";
import { SIGNALS } from "@/lib/signals/registry";

describe("resolveSignals", () => {
  it("returns {} for no selection", () => {
    expect(resolveSignals(undefined)).toEqual({});
  });
  it("'*' selects every registry id as true", () => {
    const r = resolveSignals({ groups: ["*"] });
    expect(Object.keys(r).length).toBe(SIGNALS.length);
    expect(Object.values(r).every((v) => v === true)).toBe(true);
  });
  it("selects a group by name", () => {
    const r = resolveSignals({ groups: ["Cyber threat"] });
    expect(r["cyber-c2"]).toBe(true);
    expect(r["cyber-ransomware"]).toBe(true);
    expect(r["earthquakes"]).toBeUndefined();
  });
  it("unions ids with groups then applies exclude", () => {
    const r = resolveSignals({ groups: ["Cyber threat"], ids: ["internet-outages"], exclude: ["cyber-c2"] });
    expect(r["internet-outages"]).toBe(true);
    expect(r["cyber-ransomware"]).toBe(true);
    expect(r["cyber-c2"]).toBeUndefined();
  });
});
