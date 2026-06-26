import { expect, test } from "vitest";
import { cameraFilterStore } from "@/lib/cameraFilter";

test("passes() respects region toggles and the live-only filter", () => {
  // Default: every region visible, live-only off.
  expect(cameraFilterStore.passes("tfl", false)).toBe(true);
  expect(cameraFilterStore.passes("caltrans", true)).toBe(true);

  // Live-only hides still cameras, keeps live ones.
  cameraFilterStore.setLiveOnly(true);
  expect(cameraFilterStore.passes("tfl", false)).toBe(false);
  expect(cameraFilterStore.passes("caltrans", true)).toBe(true);

  // Hiding a region drops it even when live.
  cameraFilterStore.toggleRegion("caltrans");
  expect(cameraFilterStore.passes("caltrans", true)).toBe(false);

  // Unknown sources default to visible.
  expect(cameraFilterStore.passes("mystery", true)).toBe(true);

  // Reset the singleton so other tests are unaffected.
  cameraFilterStore.toggleRegion("caltrans");
  cameraFilterStore.setLiveOnly(false);
});
