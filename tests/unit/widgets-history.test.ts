import { expect, test } from "vitest";
import { pushSample, deltaOf, trendOf, countHistoryStore, type CountSample } from "@/lib/widgets/history";

const s = (t: number, n: number): CountSample => ({ t, n });

test("pushSample appends and caps to the most recent N", () => {
  let buf: CountSample[] = [];
  for (let i = 0; i < 30; i++) buf = pushSample(buf, s(i, i), 24);
  expect(buf.length).toBe(24);
  expect(buf[0].n).toBe(6); // oldest kept = 30-24
  expect(buf[buf.length - 1].n).toBe(29);
});

test("pushSample collapses a same-count consecutive sample (only time advances)", () => {
  let buf = pushSample([], s(1, 5));
  buf = pushSample(buf, s(2, 5)); // unchanged count → keep one, update time
  expect(buf.length).toBe(1);
  expect(buf[0].t).toBe(2);
});

test("deltaOf is latest minus previous, 0 when fewer than two samples", () => {
  expect(deltaOf([])).toBe(0);
  expect(deltaOf([s(1, 10)])).toBe(0);
  expect(deltaOf([s(1, 10), s(2, 13)])).toBe(3);
  expect(deltaOf([s(1, 13), s(2, 8)])).toBe(-5);
});

test("trendOf returns the last `slots` counts normalized 0..1", () => {
  const buf = [s(1, 0), s(2, 5), s(3, 10)];
  expect(trendOf(buf, 3)).toEqual([0, 0.5, 1]);
  // all-equal → flat 0.5 line, never divide-by-zero
  expect(trendOf([s(1, 4), s(2, 4)], 2)).toEqual([0.5, 0.5]);
});

test("countHistoryStore.record skips a stable count (no subscriber churn)", () => {
  let notifications = 0;
  const unsub = countHistoryStore.subscribe(() => { notifications++; });
  countHistoryStore.record("t-stable", 5, 1000);
  countHistoryStore.record("t-stable", 5, 2000); // same count → ignored
  countHistoryStore.record("t-stable", 7, 3000); // changed → recorded
  unsub();
  const buf = countHistoryStore.get()["t-stable"];
  expect(buf.map((s) => s.n)).toEqual([5, 7]);
  expect(notifications).toBe(2); // only the two real changes notified
});

test("trendOf returns [] for non-positive slots", () => {
  expect(trendOf([{ t: 1, n: 5 }], 0)).toEqual([]);
});
