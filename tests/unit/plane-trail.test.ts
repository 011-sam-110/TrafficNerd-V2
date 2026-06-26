import { expect, test } from "vitest";
import { pushHistory, projectAhead, lookaheadKm, buildTrailPath } from "@/lib/planes/trail";

test("pushHistory caps length and drops near-duplicate samples", () => {
  let h: { lat: number; lon: number; altKm: number }[] = [];
  for (let i = 0; i < 20; i++) h = pushHistory(h, { lat: i * 0.01, lon: 0, altKm: 10 }, 12);
  expect(h).toHaveLength(12);
  const before = h.length;
  h = pushHistory(h, { ...h[h.length - 1] }, 12); // identical point
  expect(h).toHaveLength(before); // ignored
});

test("projectAhead moves roughly north for bearing 0", () => {
  const p = projectAhead(0, 0, 0, 111); // ~1° of latitude
  expect(p.lat).toBeCloseTo(1, 1);
  expect(p.lon).toBeCloseTo(0, 3);
});

test("projectAhead moves roughly east for bearing 90 at the equator", () => {
  const p = projectAhead(0, 0, 90, 111);
  expect(p.lon).toBeCloseTo(1, 1);
  expect(p.lat).toBeCloseTo(0, 3);
});

test("lookaheadKm scales with speed and clamps", () => {
  expect(lookaheadKm(null)).toBe(4); // floor
  expect(lookaheadKm(1000)).toBe(80); // ceiling
  expect(lookaheadKm(200, 90)).toBeCloseTo(18, 0); // 200 m/s * 90 s = 18 km
});

test("buildTrailPath = history + current + one projected point ahead", () => {
  const hist = [{ lat: 51, lon: 0, altKm: 10 }];
  const cur = { lat: 51.1, lon: 0, altKm: 10 };
  const path = buildTrailPath(hist, cur, 0, 200);
  expect(path).toHaveLength(3);
  expect(path[1]).toEqual(cur);
  expect(path[2].lat).toBeGreaterThan(cur.lat); // projected north of current
});
