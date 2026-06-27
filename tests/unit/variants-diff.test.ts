import { describe, it, expect } from "vitest";
import { diffFromVariant, isEmptyDelta } from "@/lib/variants/diff";
import { BUILTIN_BY_ID } from "@/lib/variants/builtins";
import { DEFAULT_STATE } from "@/lib/layers";

const explore = BUILTIN_BY_ID["explore"];

describe("diffFromVariant", () => {
  it("is empty when live matches the preset", () => {
    const layers = { ...DEFAULT_STATE, cameras: true, planes: true, satellites: false, webcams: false };
    const d = diffFromVariant({ layers, signals: {}, theme: "light" }, explore);
    expect(isEmptyDelta(d)).toBe(true);
  });
  it("captures a turned-off layer", () => {
    const layers = { ...DEFAULT_STATE, cameras: false, planes: true, satellites: false, webcams: false };
    const d = diffFromVariant({ layers, signals: {}, theme: "light" }, explore);
    expect(d.layers?.cameras).toBe(false);
  });
  it("treats a signal absent in the preset but on live as a diff", () => {
    const layers = { ...DEFAULT_STATE, cameras: true, planes: true };
    const d = diffFromVariant({ layers, signals: { earthquakes: true }, theme: "light" }, explore);
    expect(d.signals?.earthquakes).toBe(true);
  });
});
