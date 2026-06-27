import { describe, it, expect } from "vitest";
import { composeViewState } from "@/lib/share/deepLink";
import { variantStore } from "@/lib/variants/store";

const stubMap = {
  getCenter: () => ({ lat: 1, lng: 2 }),
  getZoom: () => 3,
} as unknown as import("maplibre-gl").Map;

describe("composeViewState carries the variant", () => {
  it("includes v for a non-default variant", () => {
    variantStore.bootstrap(new URLSearchParams("v=intel"));
    expect(composeViewState(stubMap).v).toBe("intel");
  });
  it("omits v for the default explore variant", () => {
    variantStore.bootstrap(new URLSearchParams("v=explore"));
    expect(composeViewState(stubMap).v).toBeUndefined();
  });
});
