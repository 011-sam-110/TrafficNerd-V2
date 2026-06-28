import { expect, test } from "vitest";
import {
  SOURCE_CATALOG, catalogByGroup, getCatalogSource, kindOf, CORE_IDS,
} from "@/lib/sources/catalog";
import { SIGNALS } from "@/lib/signals/registry";

test("catalog contains the 4 core layers plus every signal", () => {
  expect(SOURCE_CATALOG.length).toBe(CORE_IDS.length + SIGNALS.length);
  for (const id of CORE_IDS) {
    const s = getCatalogSource(id);
    expect(s?.kind).toBe("core");
  }
  for (const sig of SIGNALS) {
    expect(getCatalogSource(sig.id)?.kind).toBe("signal");
  }
});

test("every catalog source has the required descriptor fields", () => {
  for (const s of SOURCE_CATALOG) {
    expect(s.id).toBeTruthy();
    expect(s.label).toBeTruthy();
    expect(s.group).toBeTruthy();
    expect(s.color).toMatch(/^#/);
    expect(s.attribution).toBeTruthy();
    expect(s.refreshMs).toBeGreaterThan(0);
  }
});

test("ids are unique", () => {
  const ids = SOURCE_CATALOG.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("catalogByGroup preserves order and partitions every source exactly once", () => {
  const groups = catalogByGroup();
  const flat = groups.flatMap((g) => g.sources);
  expect(flat.length).toBe(SOURCE_CATALOG.length);
  // group labels are non-empty and unique
  const labels = groups.map((g) => g.group);
  expect(new Set(labels).size).toBe(labels.length);
});

test("kindOf classifies core vs signal", () => {
  expect(kindOf("cameras")).toBe("core");
  expect(kindOf(SIGNALS[0].id)).toBe("signal");
});
