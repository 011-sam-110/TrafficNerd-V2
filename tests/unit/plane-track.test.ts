import { expect, test, beforeEach } from "vitest";
import { trackStore } from "@/lib/planes/track";

beforeEach(() => trackStore.stop());

test("track() locks a plane in follow mode", () => {
  trackStore.track("plane:abc", "BA117");
  expect(trackStore.get()).toMatchObject({ id: "plane:abc", label: "BA117", mode: "follow" });
  expect(trackStore.isTracking("plane:abc")).toBe(true);
  expect(trackStore.isTracking("plane:xyz")).toBe(false);
});

test("track() falls back to the id when no label is given", () => {
  trackStore.track("plane:noname", "");
  expect(trackStore.get().label).toBe("plane:noname");
});

test("setMode flips follow⇄recenter without losing the target", () => {
  trackStore.track("plane:abc", "BA117");
  trackStore.setMode("recenter");
  expect(trackStore.get()).toMatchObject({ id: "plane:abc", mode: "recenter" });
  trackStore.setMode("follow");
  expect(trackStore.get().mode).toBe("follow");
});

test("setMode is a no-op while idle", () => {
  trackStore.setMode("recenter");
  expect(trackStore.get()).toMatchObject({ id: null, mode: "follow" });
});

test("stop() clears the target and resets mode", () => {
  trackStore.track("plane:abc", "BA117");
  trackStore.setMode("recenter");
  trackStore.stop();
  expect(trackStore.get()).toMatchObject({ id: null, label: "", mode: "follow" });
});

test("re-tracking a new plane resets to follow mode", () => {
  trackStore.track("plane:abc", "BA117");
  trackStore.setMode("recenter");
  trackStore.track("plane:def", "AF23");
  expect(trackStore.get()).toMatchObject({ id: "plane:def", label: "AF23", mode: "follow" });
});
