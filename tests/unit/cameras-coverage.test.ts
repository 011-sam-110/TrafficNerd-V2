import { describe, it, expect } from "vitest";
import { coverage, type CameraLite } from "@/lib/cameras/coverage";

const c = (o: Partial<CameraLite>): CameraLite =>
  ({ id: "x", source: "tfl", name: "n", lat: 0, lon: 0, available: true, live: false, ...o });

describe("coverage", () => {
  it("buckets live / still / offline and groups per operator", () => {
    const cov = coverage([
      c({ source: "caltrans", live: true }),
      c({ source: "caltrans", live: false }),
      c({ source: "tfl", available: false }),
    ]);
    expect(cov.total).toBe(3);
    expect(cov.live).toBe(1);
    expect(cov.still).toBe(1);
    expect(cov.offline).toBe(1);
    const caltrans = cov.byOperator.find((o) => o.source === "caltrans")!;
    expect(caltrans.total).toBe(2);
    expect(caltrans.live).toBe(1);
    const tfl = cov.byOperator.find((o) => o.source === "tfl")!;
    expect(tfl.offline).toBe(1);
  });
});
