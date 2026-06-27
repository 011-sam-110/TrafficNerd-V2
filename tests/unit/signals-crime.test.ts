import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/uk-crime.json";
import { normalizeCrime, crimeCategory } from "@/lib/signals/crime";

test("normalizes data.police.uk rows, skipping the null-location record", () => {
  const out = normalizeCrime(fixture as never);
  expect(out).toHaveLength(9); // 10 rows, the last has location:null
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["crime"]));
  expect(out[0].id).toBe("ukpolice:134642993");
  // String "lat"/"lng" are coerced to numbers and placed on the map.
  expect(out[0].lat).toBeCloseTo(51.506236, 5);
  expect(out[0].lon).toBeCloseTo(-0.141322, 5);
  // Monthly aggregate → no real-time timestamp (the time-window filter won't hide it).
  expect(out[0].ts).toBeUndefined();
  expect(out[0].props?.month).toBe("2026-04");
});

test("maps categories to labels/colours and dedupes by crime id", () => {
  const robbery = normalizeCrime(fixture as never).find((f) => f.id === "ukpolice:134678224");
  expect(robbery?.props?.category).toBe("Robbery");
  expect(robbery?.color).toBe("#dc2626");

  // A duplicate id collapses to one feature.
  const dup = [...(fixture as never[]), (fixture as never[])[0]];
  expect(normalizeCrime(dup as never)).toHaveLength(9);
});

test("crimeCategory falls back gracefully for an unknown slug", () => {
  expect(crimeCategory("anti-social-behaviour").label).toBe("Anti-social behaviour");
  expect(crimeCategory("made-up-slug")).toEqual({ label: "made up slug", color: "#64748b" });
});
