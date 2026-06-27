import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/gdelt-geo.json";
import { normalizeGdelt, firstHref, GDELT_LAYERS } from "@/lib/signals/gdelt";

test("normalizes GDELT GeoJSON, skipping null/out-of-range coords and nameless features", () => {
  const out = normalizeGdelt(fixture as never, GDELT_LAYERS.conflict);
  expect(out).toHaveLength(2); // bad-coords + out-of-range + empty-name dropped
  expect(out.every((f) => f.signalId === "conflict")).toBe(true);
  expect(out.every((f) => f.color === "#b91c1c")).toBe(true);
});

test("sorts by article count descending and carries count under `articles` (not magnitude)", () => {
  const [a, b] = normalizeGdelt(fixture as never, GDELT_LAYERS.conflict);
  expect(a.title).toBe("Baghdad, Iraq"); // count 42 outranks London's 7
  expect(a.props?.articles).toBe(42);
  expect(a.props?.magnitude).toBeUndefined(); // never distort the marker radius
  expect(b.title).toBe("London, United Kingdom");
  // representative point + namespaced id
  expect(a.lat).toBeCloseTo(33.3152, 3);
  expect(a.lon).toBeCloseTo(44.3661, 3);
  expect(a.id).toBe("gdelt:conflict:33.315:44.366");
});

test("extracts the first article href from the html popup as the link", () => {
  const [a, b] = normalizeGdelt(fixture as never, GDELT_LAYERS.conflict);
  expect(a.link).toBe("https://example.com/baghdad-clashes");
  expect(b.link).toBeUndefined(); // London popup has no anchor
});

test("the cap bounds the output regardless of feature count", () => {
  const out = normalizeGdelt(fixture as never, GDELT_LAYERS.protests, 1);
  expect(out).toHaveLength(1);
  expect(out[0].title).toBe("Baghdad, Iraq"); // highest count survives the cap
  expect(out[0].signalId).toBe("protests");
});

test("firstHref decodes entities and rejects non-http", () => {
  expect(firstHref('<a href="https://x.com/a?b=1&amp;c=2">x</a>')).toBe("https://x.com/a?b=1&c=2");
  expect(firstHref('<a href="javascript:alert(1)">x</a>')).toBeUndefined();
  expect(firstHref(null)).toBeUndefined();
  expect(firstHref("no anchor here")).toBeUndefined();
});
