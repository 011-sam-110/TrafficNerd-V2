import { expect, test } from "vitest";
import { summarizeChokepoints, congestionLevel, congestionColor } from "@/lib/console/signals/chokepoints";
import { chokepointFor } from "@/lib/signals/ais";
import { normalizeAis } from "@/lib/signals/ais";
import fixture from "@/tests/fixtures/ais-vessels.json";
import type { SignalFeature } from "@/lib/signals/types";

const v = (chokepoint: string, speedKt: number): SignalFeature => ({
  id: `ais:${Math.round(speedKt * 1000)}:${chokepoint}`,
  lat: 0, lon: 0, title: "x", signalId: "ais",
  props: { chokepoint, speedKt },
});

test("chokepointFor places a position in the right strait, else undefined", () => {
  expect(chokepointFor(25.5, 56)).toBe("Strait of Hormuz");
  expect(chokepointFor(50.4, -0.5)).toBe("English Channel");
  expect(chokepointFor(0, 0)).toBeUndefined(); // open water
});

test("congestionLevel maps the stopped ratio, honest 'unknown' on a small sample", () => {
  expect(congestionLevel(0, 3)).toBe("unknown"); // < 4 vessels
  expect(congestionLevel(1, 10)).toBe("flowing"); // 10% stopped
  expect(congestionLevel(4, 10)).toBe("busy"); // 40% stopped
  expect(congestionLevel(7, 10)).toBe("congested"); // 70% stopped
});

test("summarizeChokepoints groups, counts moving vs stopped and averages speed", () => {
  const stats = summarizeChokepoints([
    v("Strait of Hormuz", 12), v("Strait of Hormuz", 8), v("Strait of Hormuz", 0), v("Strait of Hormuz", 0), v("Strait of Hormuz", 0),
    v("Panama Canal", 10), v("Panama Canal", 14),
  ]);
  const hormuz = stats.find((s) => s.name === "Strait of Hormuz")!;
  expect(hormuz.total).toBe(5);
  expect(hormuz.moving).toBe(2);
  expect(hormuz.stopped).toBe(3);
  expect(hormuz.avgSpeed).toBe(10); // (12+8)/2
  expect(hormuz.congestion).toBe("congested"); // 3/5 = 60%
  // Busiest strait sorts first.
  expect(stats[0].name).toBe("Strait of Hormuz");
});

test("untagged vessels bucket into 'Open water' and sink to the bottom", () => {
  const stats = summarizeChokepoints([
    { id: "ais:1", lat: 0, lon: 0, title: "x", signalId: "ais", props: { speedKt: 5 } },
    v("Bosphorus", 3),
  ]);
  expect(stats[stats.length - 1].name).toBe("Open water");
});

test("real fixture vessels carry a chokepoint tag through normalizeAis", () => {
  const out = normalizeAis(fixture as never);
  const maersk = out.find((f) => f.id === "ais:219179000")!;
  expect(maersk.props?.chokepoint).toBe("English Channel"); // 50.42,-0.47
  expect(maersk.props?.speedKt).toBe(13.5);
});

test("congestionColor gives each level a status hue", () => {
  expect(congestionColor("flowing")).toBe("#16a34a");
  expect(congestionColor("congested")).toBe("#d9534f");
  expect(congestionColor("unknown")).toBe("#64748b");
});
