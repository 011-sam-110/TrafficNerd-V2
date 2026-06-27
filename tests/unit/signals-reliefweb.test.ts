import { expect, test } from "vitest";
// Schema-based fixture (ReliefWeb requires an approved appname; no live capture).
// Field shapes mirror a real /v2/disasters?profile=full response.
import fixture from "@/tests/fixtures/reliefweb-disasters.json";
import { normalizeReliefWeb, disasterColor } from "@/lib/signals/reliefweb";

test("normalizes located disasters, falling back to centroid then skipping the unlocatable", () => {
  const out = normalizeReliefWeb(fixture as never);
  // Sudan (own loc), Philippines (own loc), Afghanistan (centroid fallback) = 3;
  // the "ZZZ" region-wide appeal has neither → skipped.
  expect(out).toHaveLength(3);
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["reliefweb"]));

  const sudan = out.find((f) => f.id === "reliefweb:12001")!;
  expect(sudan.props?.country).toBe("Sudan");
  expect(sudan.props?.status).toBe("current");
  expect(sudan.color).toBe(disasterColor("CE"));
  expect(sudan.lat).toBeCloseTo(15.5);
  expect(sudan.link).toContain("reliefweb.int");
  expect(sudan.ts).toBe("2026-06-26T08:00:00+00:00");

  // Afghanistan has no location → resolved from the ISO-3 centroid.
  const afg = out.find((f) => f.id === "reliefweb:12003")!;
  expect(Number.isFinite(afg.lat)).toBe(true);
  expect(afg.props?.types).toBe("Earthquake");
});

test("alerts get a bigger marker than current emergencies; type colours map", () => {
  const out = normalizeReliefWeb(fixture as never);
  const alert = out.find((f) => f.id === "reliefweb:12002")!; // Philippines, status alert
  const current = out.find((f) => f.id === "reliefweb:12001")!; // Sudan, status current
  expect(Number(alert.props?.magnitude)).toBeGreaterThan(Number(current.props?.magnitude));
  expect(alert.color).toBe(disasterColor("TC"));
  expect(disasterColor("FL")).toBe("#2563eb");
  expect(disasterColor("DR")).toBe("#a16207");
  expect(disasterColor("ZZ")).toBe("#64748b"); // unknown type
});
