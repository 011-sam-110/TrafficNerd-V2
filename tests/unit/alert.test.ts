import { expect, test } from "vitest";
import { selectBreakingAlert } from "@/lib/alert";
import type { SignalFeature } from "@/lib/signals/types";
import type { NewsItem } from "@/lib/news";

const NOW = Date.parse("2026-06-27T12:00:00Z");

function quake(id: string, mag: number, agoMin: number): SignalFeature {
  return {
    id,
    lat: 10,
    lon: 20,
    title: `M ${mag} — somewhere`,
    signalId: "earthquakes",
    ts: new Date(NOW - agoMin * 60_000).toISOString(),
    props: { magnitude: mag, place: "12km S of Town" },
  };
}

function news(title: string, source: string, agoMin: number): NewsItem {
  return { title, source, url: `https://x/${title.replace(/\W+/g, "-")}`, ts: NOW - agoMin * 60_000 };
}

test("returns null when nothing qualifies", () => {
  expect(selectBreakingAlert([], [], NOW)).toBeNull();
  expect(selectBreakingAlert([quake("a", 4.2, 10)], [], NOW)).toBeNull(); // below mag 6
});

test("surfaces a major recent earthquake and flies to it", () => {
  const a = selectBreakingAlert([quake("small", 5.0, 5), quake("big", 6.4, 30)], [], NOW);
  expect(a).not.toBeNull();
  expect(a!.kind).toBe("quake");
  expect(a!.key).toBe("quake:big");
  expect(a!.text).toContain("6.4");
  expect(a!.detail).toContain("12km S of Town");
  expect(a!.action).toEqual({ type: "fly", lat: 10, lon: 20 });
});

test("ignores an old major quake (outside the recent window)", () => {
  const a = selectBreakingAlert([quake("stale", 7.0, 60 * 24)], [], NOW); // 24h ago
  expect(a).toBeNull();
});

test("a quake outranks a news cluster", () => {
  const cluster = [
    news("Floods devastate region", "BBC", 5),
    news("Region floods worsen", "NPR", 8),
    news("More floods in region", "Al Jazeera", 12),
  ];
  const a = selectBreakingAlert([quake("big", 6.1, 10)], cluster, NOW);
  expect(a!.kind).toBe("quake");
});

test("surfaces a corroborated news cluster across multiple outlets", () => {
  const cluster = [
    news("Floods devastate coastal region", "BBC", 5),
    news("Region floods worsen overnight", "NPR", 8),
    news("More floods reported in region", "Al Jazeera", 12),
    news("Unrelated sports result", "BBC", 2),
  ];
  const a = selectBreakingAlert([], cluster, NOW);
  expect(a).not.toBeNull();
  expect(a!.kind).toBe("news");
  expect(a!.key).toMatch(/^news:(floods|region)$/);
  expect(a!.detail).toContain("outlets");
  expect(a!.action.type).toBe("open");
  // the newest headline of the cluster is shown
  expect(a!.text).toBe("Floods devastate coastal region");
});

test("a single outlet repeating a word does NOT trip the alert (no crying wolf)", () => {
  const cluster = [
    news("Budget talks continue today", "BBC", 5),
    news("Budget talks stall again", "BBC", 8),
    news("Budget talks resume tomorrow", "BBC", 12),
  ];
  expect(selectBreakingAlert([], cluster, NOW)).toBeNull(); // only one source
});
