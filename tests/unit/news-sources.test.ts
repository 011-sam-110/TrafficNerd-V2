import { expect, test } from "vitest";
import { sourceMeta, faviconUrl, sourceInitial } from "@/lib/news/sources";

test("sourceMeta attributes known outlets with region + type", () => {
  expect(sourceMeta("BBC")).toMatchObject({ domain: "bbc.com", region: "UK", type: "Public broadcaster" });
  expect(sourceMeta("Al Jazeera").region).toBe("Middle East");
  expect(sourceMeta("NPR").region).toBe("US");
  expect(sourceMeta("The Guardian").type).toBe("Newspaper");
  expect(sourceMeta("France 24").region).toBe("Europe");
  expect(sourceMeta("Reuters").type).toBe("Newswire");
});

test("sourceMeta is case-insensitive on the display name", () => {
  expect(sourceMeta("bbc").domain).toBe("bbc.com");
  expect(sourceMeta("  the guardian ").domain).toBe("theguardian.com");
});

test("unknown source degrades honestly (no fabricated attribution)", () => {
  const m = sourceMeta("Some Blog");
  expect(m.domain).toBeNull();
  expect(m.region).toBe("Other");
  expect(faviconUrl(m.domain)).toBeNull();
});

test("faviconUrl builds a keyless icon URL", () => {
  expect(faviconUrl("bbc.com", 32)).toBe("https://www.google.com/s2/favicons?domain=bbc.com&sz=32");
  expect(faviconUrl(null)).toBeNull();
});

test("sourceInitial gives a stable monogram fallback", () => {
  expect(sourceInitial("BBC")).toBe("B");
  expect(sourceInitial("The Guardian")).toBe("G"); // leading "The" dropped
  expect(sourceInitial("")).toBe("?");
});
