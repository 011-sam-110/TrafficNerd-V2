import { expect, test } from "vitest";
import { buildSynthesisPrompt, parseSynthesisResponse, synthesisKey } from "@/lib/news/synthesis";

const input = {
  title: "US strikes Iran",
  sources: [
    { source: "BBC", title: "US launches strikes on Iran", description: "Overnight action" },
    { source: "Al Jazeera", title: "US strikes Iran for a second night" },
  ],
};

test("buildSynthesisPrompt lists every source with its headline", () => {
  const p = buildSynthesisPrompt(input);
  expect(p).toContain("[BBC] US launches strikes on Iran — Overnight action");
  expect(p).toContain("[Al Jazeera] US strikes Iran for a second night");
  expect(p).toContain("consensus");
  expect(p).toContain("discrepancies");
});

test("parseSynthesisResponse extracts trimmed content or null", () => {
  expect(parseSynthesisResponse({ choices: [{ message: { content: "  Consensus text.  " } }] })).toBe("Consensus text.");
  expect(parseSynthesisResponse({ choices: [] })).toBeNull();
  expect(parseSynthesisResponse({})).toBeNull();
  expect(parseSynthesisResponse(null)).toBeNull();
});

test("synthesisKey is order-independent over sources", () => {
  const reordered = { title: input.title, sources: [input.sources[1], input.sources[0]] };
  expect(synthesisKey(input)).toBe(synthesisKey(reordered));
});
