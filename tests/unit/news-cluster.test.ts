import { expect, test } from "vitest";
import { normalizeTitle, titleTokens, overlap, clusterNews } from "@/lib/news/cluster";
import type { NewsItem } from "@/lib/news";

const it = (title: string, source: string, ts: number, url = `https://x/${Math.random()}`): NewsItem => ({
  title,
  source,
  url,
  ts,
});

test("normalizeTitle strips publisher suffix + punctuation and lower-cases", () => {
  expect(normalizeTitle("Big story unfolds - BBC News")).toBe("big story unfolds");
  expect(normalizeTitle("Something happens | Reuters")).toBe("something happens");
  expect(normalizeTitle("It’s a Test, really!")).toBe("its a test really");
});

test("titleTokens drops short words + stop-words", () => {
  const t = titleTokens("The US strikes Iran after an attack");
  expect(t.has("strikes")).toBe(true);
  expect(t.has("iran")).toBe(true);
  expect(t.has("attack")).toBe(true);
  expect(t.has("the")).toBe(false);
  expect(t.has("us")).toBe(false); // 2 chars
  expect(t.has("after")).toBe(false); // stop word
});

test("overlap returns jaccard + shared count + overlap coefficient", () => {
  const a = new Set(["ukraine", "licence", "patriot", "build"]);
  const b = new Set(["ukraine", "licence", "patriot", "produce"]);
  const o = overlap(a, b);
  expect(o.shared).toBe(3);
  expect(o.score).toBeCloseTo(3 / 5, 5);
  expect(o.coeff).toBeCloseTo(3 / 4, 5); // shared / min-size
  expect(overlap(new Set(), a)).toEqual({ score: 0, shared: 0, coeff: 0 });
});

test("clusterNews groups a cross-source story and keeps unrelated ones apart", () => {
  const items: NewsItem[] = [
    it("US gives Ukraine licence to build Patriot missiles", "BBC", 100),
    it("Ukraine to get licence to produce Patriot systems", "France 24", 300),
    it("Patriot missiles: Ukraine granted licence to build", "Al Jazeera", 200),
    it("Bucknell coach charged in hazing death case", "NPR", 250),
  ];
  const clusters = clusterNews(items);
  expect(clusters).toHaveLength(2);

  const patriot = clusters.find((c) => c.sourceCount === 3)!;
  expect(patriot).toBeTruthy();
  expect(patriot.sources.sort()).toEqual(["Al Jazeera", "BBC", "France 24"]);
  // lead is the newest (France 24 @ 300)
  expect(patriot.lead.source).toBe("France 24");
  expect(patriot.latestTs).toBe(300);
  expect(patriot.earliestTs).toBe(100);

  const lone = clusters.find((c) => c.sourceCount === 1)!;
  expect(lone.lead.source).toBe("NPR");
});

test("differently-phrased cross-source headlines fuse via the overlap-coefficient rule", () => {
  const items: NewsItem[] = [
    it("Jordan air defences intercept and destroy multiple Iranian ballistic missiles fired overnight", "Al Jazeera", 400),
    it("Jordan downs three Iranian missiles", "France 24", 380),
  ];
  // Jaccard is only ~0.23 (the long headline dilutes the union), but the short
  // headline's core entities (jordan/iranian/missiles) are ≥60% contained — same event.
  const clusters = clusterNews(items);
  expect(clusters).toHaveLength(1);
  expect(clusters[0].sourceCount).toBe(2);
});

test("a single shared token does not fuse unrelated stories", () => {
  const items: NewsItem[] = [
    it("Iran holds parliamentary elections", "BBC", 100),
    it("Iran football team qualifies for final", "NPR", 90),
  ];
  const clusters = clusterNews(items);
  expect(clusters).toHaveLength(2); // only "iran" in common → not merged
});

test("clusterNews is dormant-safe on empty input", () => {
  expect(clusterNews([])).toEqual([]);
});
