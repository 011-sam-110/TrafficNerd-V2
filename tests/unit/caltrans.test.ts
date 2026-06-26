import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/caltrans-d11.json";
import { normalizeCaltrans } from "@/lib/sources/caltrans";
import { CameraArray } from "@/lib/types";

test("normalizes Caltrans records into valid Cameras and skips no-media records", () => {
  const cams = normalizeCaltrans(fixture as never, 11);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(2); // record 3 has no image and no stream
});

test("maps id, region, media type, availability and refresh", () => {
  const [a, b] = normalizeCaltrans(fixture as never, 11);
  expect(a.id).toBe("caltrans:d11-1");
  expect(a.country).toBe("US");
  expect(a.region).toBe("California");
  expect(a.mediaType).toBe("both"); // has a stream
  expect(a.available).toBe(true);
  expect(a.road).toBe("SR-163");
  expect(a.refreshSeconds).toBe(120); // 2 minutes * 60
  expect(b.mediaType).toBe("jpeg"); // empty streamingVideoURL
  expect(b.available).toBe(false);
});
