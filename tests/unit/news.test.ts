import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseRss, mergeNews, type NewsItem } from "@/lib/news";

const xml = readFileSync("tests/fixtures/rss-sample.xml", "utf8");

test("parses RSS items, decoding entities + CDATA and skipping missing/relative links", () => {
  const out = parseRss(xml, "BBC");
  expect(out).toHaveLength(2); // no-link + relative-link items dropped
  expect(out[0].title).toBe("US strikes on Iran after attack on cargo ship");
  expect(out[0].source).toBe("BBC");
  // entity in the link is decoded; http link kept
  expect(out[0].url).toBe(
    "https://www.bbc.co.uk/news/articles/ckg590wqxwpo?at_medium=RSS&at_campaign=rss",
  );
  expect(out[0].ts).toBe(Date.parse("Sat, 27 Jun 2026 02:48:12 GMT"));
  // CDATA title unwrapped
  expect(out[1].title).toBe("Venezuela earthquakes kill 920 as rescue teams arrive");
});

test("empty / null XML is dormant-safe", () => {
  expect(parseRss("", "X")).toEqual([]);
  expect(parseRss(null, "X")).toEqual([]);
  expect(parseRss("<rss></rss>", "X")).toEqual([]);
});

test("mergeNews sorts newest-first, dedupes by url and title, and caps", () => {
  const a: NewsItem[] = [
    { title: "Quake hits coast", source: "BBC", url: "https://x.com/a", ts: 100 },
    { title: "Older story", source: "BBC", url: "https://x.com/b", ts: 50 },
  ];
  const b: NewsItem[] = [
    // same story, different feed + tracking query → deduped by normalised title/url
    { title: "Quake Hits Coast!", source: "NPR", url: "https://x.com/a?utm=rss", ts: 120 },
    { title: "Newest", source: "NPR", url: "https://x.com/c", ts: 200 },
  ];
  const merged = mergeNews([a, b], 10);
  expect(merged.map((m) => m.title)).toEqual(["Newest", "Quake Hits Coast!", "Older story"]);
  expect(merged[0].ts).toBe(200); // newest first

  const capped = mergeNews([a, b], 2);
  expect(capped).toHaveLength(2);
});
