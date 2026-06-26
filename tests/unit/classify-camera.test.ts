import { expect, test } from "vitest";
import { cameraFeed } from "@/lib/cameras/classify";

test("a live (HLS-proxyable) stream is 'video', otherwise 'still'", () => {
  expect(cameraFeed(true)).toBe("video");
  expect(cameraFeed(false)).toBe("still");
});
