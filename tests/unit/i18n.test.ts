import { expect, test } from "vitest";
import { CATALOG, LANGS, DEFAULT_LANG, translate, type StringKey } from "@/lib/i18n/catalog";

const KEYS = Object.keys(CATALOG.en) as StringKey[];

test("every language covers exactly the English key set (no missing/extra)", () => {
  for (const { code } of LANGS) {
    expect(Object.keys(CATALOG[code]).sort()).toEqual([...KEYS].sort());
  }
});

test("no translated string is empty", () => {
  for (const { code } of LANGS) {
    for (const k of KEYS) expect(CATALOG[code][k].length).toBeGreaterThan(0);
  }
});

test("translate returns the right language's string", () => {
  expect(translate("en", "btnShare")).toBe("Share");
  expect(translate("es", "btnShare")).toBe("Compartir");
  expect(translate("fr", "btnShare")).toBe("Partager");
});

test("translate falls back to English for an unknown language", () => {
  expect(translate("de" as never, "railLayers")).toBe("Layers");
});

test("translate falls back to the raw key for an unknown key", () => {
  expect(translate("en", "nope" as never)).toBe("nope");
});

test("English is the default and is complete", () => {
  expect(DEFAULT_LANG).toBe("en");
  expect(LANGS.map((l) => l.code)).toContain("en");
});
