import { expect, test } from "vitest";
import {
  addToWatchlist,
  removeFromWatchlist,
  formatViewLabel,
  WATCHLIST_CAP,
  type SavedPlace,
} from "@/lib/shell/watchlist";

function place(id: string, savedAt = 1): SavedPlace {
  return { id, label: id, kind: "view", lat: 51.5, lon: -0.1, zoom: 8, savedAt };
}

test("addToWatchlist puts the newest entry first", () => {
  const list = addToWatchlist(addToWatchlist([], place("a")), place("b"));
  expect(list.map((e) => e.id)).toEqual(["b", "a"]);
});

test("adding the same id replaces (dedupes), keeping it newest", () => {
  const list = addToWatchlist(
    addToWatchlist(addToWatchlist([], place("a")), place("b")),
    { ...place("a"), label: "updated" },
  );
  expect(list.map((e) => e.id)).toEqual(["a", "b"]);
  expect(list[0].label).toBe("updated");
});

test("the list is capped (oldest dropped)", () => {
  let list: SavedPlace[] = [];
  for (let i = 0; i < WATCHLIST_CAP + 5; i++) list = addToWatchlist(list, place(`p${i}`, i));
  expect(list.length).toBe(WATCHLIST_CAP);
  expect(list[0].id).toBe(`p${WATCHLIST_CAP + 4}`); // newest
  expect(list.some((e) => e.id === "p0")).toBe(false); // oldest gone
});

test("removeFromWatchlist drops the matching id only", () => {
  const list = addToWatchlist(addToWatchlist([], place("a")), place("b"));
  expect(removeFromWatchlist(list, "a").map((e) => e.id)).toEqual(["b"]);
  expect(removeFromWatchlist(list, "missing").map((e) => e.id)).toEqual(["b", "a"]);
});

test("formatViewLabel renders signed lat/lon with hemispheres", () => {
  expect(formatViewLabel(51.5074, -0.1278)).toBe("51.51°N, 0.13°W");
  expect(formatViewLabel(-33.87, 151.21)).toBe("33.87°S, 151.21°E");
});
