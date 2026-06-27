import { expect, test } from "vitest";
// NOTE: schema-based fixture (the live read API is access-gated). Field shapes
// mirror a real ACLED /api/acled/read response per the official docs.
import fixture from "@/tests/fixtures/acled-events.json";
import { normalizeAcled, acledColor } from "@/lib/signals/acled";

test("normalizes ACLED events, skipping rows with no coordinates", () => {
  const out = normalizeAcled(fixture as never);
  expect(out).toHaveLength(5); // 5 located events; the empty-coord "BAD0000" is skipped
  expect(new Set(out.map((f) => f.signalId))).toEqual(new Set(["acled"]));

  const battle = out.find((f) => f.id === "acled:UKR12345")!;
  expect(battle.props?.eventType).toBe("Battles");
  expect(battle.color).toBe("#dc2626");
  expect(battle.props?.fatalities).toBe(14);
  expect(battle.props?.actors).toBe("Military Forces of Russia vs Military Forces of Ukraine");
  expect(battle.ts).toBe("2026-06-26");
  expect(Number(battle.props?.magnitude)).toBeGreaterThanOrEqual(2);
});

test("non-fatal events keep a visible base radius; colours map by event type", () => {
  const out = normalizeAcled(fixture as never);
  const protest = out.find((f) => f.id === "acled:FRA4567")!;
  expect(protest.props?.fatalities).toBe(0);
  expect(protest.props?.magnitude).toBe(2);
  expect(protest.color).toBe(acledColor("Protests"));

  expect(acledColor("Violence against civilians")).toBe("#7f1d1d");
  expect(acledColor("Explosions/Remote violence")).toBe("#9333ea");
  expect(acledColor("Riots")).toBe("#ea580c");
  expect(acledColor("Strategic developments")).toBe("#64748b");
});
