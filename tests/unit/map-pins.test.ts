import { expect, test, beforeEach } from "vitest";
import { pinsStore, cycleIndex, coordLabel } from "@/lib/map/pins";

beforeEach(() => pinsStore.clear());

test("cycleIndex wraps and handles the empty/unselected cases", () => {
  expect(cycleIndex(0, -1, 1)).toBe(-1);
  expect(cycleIndex(3, -1, 1)).toBe(0); // nothing selected → first
  expect(cycleIndex(3, -1, -1)).toBe(2); // nothing selected → last
  expect(cycleIndex(3, 2, 1)).toBe(0); // wrap forward
  expect(cycleIndex(3, 0, -1)).toBe(2); // wrap back
  expect(cycleIndex(3, 1, 1)).toBe(2);
});

test("coordLabel formats to 3dp", () => {
  expect(coordLabel(51.50735, -0.12776)).toBe("51.507, -0.128");
});

test("add() appends and activates; empty label falls back to coords", () => {
  const a = pinsStore.add(51.5, -0.12, "London");
  expect(pinsStore.get().pins).toHaveLength(1);
  expect(pinsStore.get().activeId).toBe(a.id);
  const b = pinsStore.add(48.85, 2.35, "");
  expect(b.label).toBe("48.850, 2.350");
  expect(pinsStore.get().activeId).toBe(b.id);
});

test("cycle() walks the list and wraps", () => {
  const a = pinsStore.add(1, 1, "A");
  const b = pinsStore.add(2, 2, "B");
  pinsStore.setActive(a.id);
  expect(pinsStore.cycle(1)?.id).toBe(b.id);
  expect(pinsStore.cycle(1)?.id).toBe(a.id); // wrap
  expect(pinsStore.cycle(-1)?.id).toBe(b.id); // wrap back
});

test("remove() keeps a sensible active selection", () => {
  const a = pinsStore.add(1, 1, "A");
  const b = pinsStore.add(2, 2, "B");
  const c = pinsStore.add(3, 3, "C");
  pinsStore.setActive(b.id);
  pinsStore.remove(b.id);
  expect(pinsStore.get().pins.map((p) => p.id)).toEqual([a.id, c.id]);
  expect(pinsStore.get().activeId).toBe(c.id); // fell to the next in place
  pinsStore.remove(c.id);
  pinsStore.remove(a.id);
  expect(pinsStore.get().activeId).toBeNull();
});

test("relabel updates only the matching pin", () => {
  const a = pinsStore.add(1, 1, "old");
  pinsStore.relabel(a.id, "New Place");
  expect(pinsStore.get().pins[0].label).toBe("New Place");
  pinsStore.relabel(a.id, "   "); // blank ignored
  expect(pinsStore.get().pins[0].label).toBe("New Place");
});
