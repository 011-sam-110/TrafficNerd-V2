import { describe, it, expect } from "vitest";
import { pickLiveCamera } from "@/lib/cinematic/livePick";

const c = (id: string, available: boolean, live: boolean) => ({ id, available, live });

describe("pickLiveCamera", () => {
  it("returns the first available && live camera in input order", () => {
    const cams = [c("a", true, false), c("b", false, true), c("c", true, true), c("d", true, true)];
    expect(pickLiveCamera(cams)?.id).toBe("c");
  });
  it("returns null when none are live", () => {
    expect(pickLiveCamera([c("a", true, false), c("b", false, true)])).toBeNull();
  });
  it("returns null for an empty list", () => {
    expect(pickLiveCamera([])).toBeNull();
  });
});
