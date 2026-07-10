import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseTelegram } from "@/lib/news/telegram";

const html = readFileSync(
  fileURLToPath(new URL("../fixtures/telegram-liveuamap.html", import.meta.url)),
  "utf8",
);

test("parseTelegram turns channel posts into NewsItems, skipping media-only posts", () => {
  const items = parseTelegram(html, "Liveuamap");
  expect(items).toHaveLength(2); // the photo-only post (no text) is skipped
  expect(items.every((i) => i.source === "Liveuamap")).toBe(true);
});

test("prefers the embedded article link, and strips its URL out of the headline", () => {
  const [first] = parseTelegram(html, "Liveuamap");
  expect(first.title).toContain("Lebanese Ministry of Health");
  expect(first.title).not.toContain("http"); // the trailing source URL is not part of the headline
  expect(first.url).toBe(
    "https://lebanon.liveuamap.com/en/2026/6-july-12-lebanese-ministry-of-health-four-people-killed",
  );
  expect(first.ts).toBe(Date.parse("2026-07-06T13:00:01+00:00"));
});

test("falls back to the t.me permalink when a post has no external link, and decodes entities", () => {
  const second = parseTelegram(html, "Liveuamap")[1];
  expect(second.title).toBe(
    "Ukraine: explosions reported near Kharkiv city center & ongoing power outages",
  );
  expect(second.url).toBe("https://t.me/liveuamap/12206");
  expect(second.ts).toBe(Date.parse("2026-07-07T07:58:24+00:00"));
});

test("empty / junk input degrades to [] (dormant-safe)", () => {
  expect(parseTelegram("", "Liveuamap")).toEqual([]);
  expect(parseTelegram(null, "Liveuamap")).toEqual([]);
  expect(parseTelegram("<html>no messages here</html>", "Liveuamap")).toEqual([]);
});
