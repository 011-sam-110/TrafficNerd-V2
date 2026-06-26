import { expect, test } from "vitest";
import { classifySatellite } from "@/lib/satellites/classify";

test("recognises the major satellite types by name", () => {
  expect(classifySatellite("ISS (ZARYA)")).toBe("station");
  expect(classifySatellite("CSS (TIANHE)")).toBe("station");
  expect(classifySatellite("STARLINK-1234")).toBe("starlink");
  expect(classifySatellite("ONEWEB-0421")).toBe("oneweb");
  expect(classifySatellite("NAVSTAR 80 (USA 309)")).toBe("navigation");
  expect(classifySatellite("GSAT0209 (GALILEO 15)")).toBe("navigation");
  expect(classifySatellite("NOAA 19")).toBe("weather");
  expect(classifySatellite("SENTINEL-2A")).toBe("earth-observation");
  expect(classifySatellite("HST")).toBe("science");
  expect(classifySatellite("INTELSAT 901")).toBe("communications");
});

test("spent stages and fragments are debris, even when they embed other words", () => {
  expect(classifySatellite("SL-16 R/B")).toBe("debris");
  expect(classifySatellite("FALCON 9 DEB")).toBe("debris");
});

test("unknown names fall back to 'other'", () => {
  expect(classifySatellite("MYSTERY OBJECT 42")).toBe("other");
  expect(classifySatellite("")).toBe("other");
});
