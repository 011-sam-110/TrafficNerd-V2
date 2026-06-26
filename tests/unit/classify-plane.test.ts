import { expect, test } from "vitest";
import { classifyPlane } from "@/lib/planes/classify";

test("on-ground aircraft are 'ground' regardless of speed", () => {
  expect(classifyPlane({ altKm: 0, velocityMs: 5, onGround: true })).toBe("ground");
});

test("high + fast is an airliner", () => {
  expect(classifyPlane({ altKm: 11, velocityMs: 230, onGround: false })).toBe("airliner");
});

test("low + slow airborne is a helicopter", () => {
  expect(classifyPlane({ altKm: 0.6, velocityMs: 40, onGround: false })).toBe("helicopter");
});

test("mid band or fast-but-lower is regional", () => {
  expect(classifyPlane({ altKm: 4.5, velocityMs: 130, onGround: false })).toBe("regional");
  expect(classifyPlane({ altKm: 2, velocityMs: 140, onGround: false })).toBe("regional");
});

test("low and modest speed is a light aircraft", () => {
  expect(classifyPlane({ altKm: 1.2, velocityMs: 85, onGround: false })).toBe("light");
});

test("null speed is treated as zero (no crash)", () => {
  expect(classifyPlane({ altKm: 0.5, velocityMs: null, onGround: false })).toBe("helicopter");
});
