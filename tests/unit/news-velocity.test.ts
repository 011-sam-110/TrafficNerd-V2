import { expect, test } from "vitest";
import { clusterNews } from "@/lib/news/cluster";
import { clusterVelocity, velocityLabel } from "@/lib/news/velocity";
import type { NewsItem } from "@/lib/news";

const NOW = 1_700_000_000_000;
const mk = (title: string, source: string, ageMin: number): NewsItem => ({
  title,
  source,
  url: `https://x/${source}/${ageMin}`,
  ts: NOW - ageMin * 60_000,
});

test("clusterVelocity counts distinct sources inside the window", () => {
  const items = [
    mk("Major quake hits coastal city", "BBC", 2),
    mk("Quake hits coastal city hard", "NPR", 5),
    mk("Coastal city quake kills dozens", "Al Jazeera", 30), // outside 10m window
  ];
  const cluster = clusterNews(items)[0];
  const v = clusterVelocity(cluster, NOW)!;
  expect(v.recentSources).toBe(2); // BBC + NPR within 10m
  expect(v.totalSources).toBe(3);
  expect(v.trending).toBe(true);
  expect(velocityLabel(v)).toBe("+2 sources in 10m");
});

test("no recent sources → no label", () => {
  const items = [mk("Old story about markets", "BBC", 90)];
  const cluster = clusterNews(items)[0];
  const v = clusterVelocity(cluster, NOW)!;
  expect(v.recentSources).toBe(0);
  expect(velocityLabel(v)).toBeNull();
});

test("no timestamps → null velocity (honest degrade)", () => {
  const items: NewsItem[] = [{ title: "Story with no date", source: "BBC", url: "https://x/1", ts: 0 }];
  const cluster = clusterNews(items)[0];
  expect(clusterVelocity(cluster, NOW)).toBeNull();
  expect(velocityLabel(null)).toBeNull();
});
