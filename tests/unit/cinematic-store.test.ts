import { describe, it, expect, beforeEach } from "vitest";
import { cinematic } from "@/lib/cinematic/store";
import type { WorldObject } from "@/lib/world";

const cam = (id: string): WorldObject => ({
  kind: "camera", id, lat: 51.5, lon: -0.12, label: `Cam ${id}`,
});

describe("cinematic dive store", () => {
  beforeEach(() => cinematic.close());

  it("starts idle with no target", () => {
    expect(cinematic.get()).toEqual({ phase: "idle", target: null });
  });

  it("dive() enters the diving phase carrying the target", () => {
    cinematic.dive(cam("a"));
    expect(cinematic.get().phase).toBe("diving");
    expect(cinematic.get().target?.id).toBe("a");
  });

  it("land() promotes diving → landed, keeping the target", () => {
    cinematic.dive(cam("a"));
    cinematic.land();
    expect(cinematic.get().phase).toBe("landed");
    expect(cinematic.get().target?.id).toBe("a");
  });

  it("land() is a no-op when not diving", () => {
    cinematic.land();
    expect(cinematic.get().phase).toBe("idle");
  });

  it("diving to a new target while landed re-dives", () => {
    cinematic.dive(cam("a"));
    cinematic.land();
    cinematic.dive(cam("b"));
    expect(cinematic.get().phase).toBe("diving");
    expect(cinematic.get().target?.id).toBe("b");
  });

  it("close() resets to idle/null and notifies subscribers", () => {
    let hits = 0;
    const unsub = cinematic.subscribe(() => { hits += 1; });
    cinematic.dive(cam("a"));
    cinematic.close();
    expect(cinematic.get()).toEqual({ phase: "idle", target: null });
    expect(hits).toBeGreaterThanOrEqual(2);
    unsub();
  });
});
