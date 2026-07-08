// lib/chart/scale.ts
// Pure 1-D scale maths shared by the native SVG charts. No DOM, node-testable.

export function extent(values: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!Number.isFinite(lo)) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
}

export function linear(domain: [number, number], range: [number, number]): (x: number) => number {
  const [d0, d1] = domain, [r0, r1] = range;
  const m = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (x) => r0 + (x - d0) * m;
}
