import { expect, test } from "vitest";
import { classifyCameraFeed } from "@/lib/cameras/classify";

test("jpeg snapshots are 'still', streams are 'video'", () => {
  expect(classifyCameraFeed("jpeg")).toBe("still");
  expect(classifyCameraFeed("video")).toBe("video");
  expect(classifyCameraFeed("both")).toBe("video");
});
