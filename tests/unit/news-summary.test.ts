// tests/unit/news-summary.test.ts
import { describe, it, expect } from "vitest";
import { buildSummaryPrompt, parseSummaryResponse } from "@/lib/news/summary";

describe("news summary", () => {
  it("builds a grounded, non-speculative prompt containing the article text", () => {
    const p = buildSummaryPrompt({ title: "T", source: "BBC", text: "Body of the article." });
    expect(p).toContain("Body of the article.");
    expect(p.toLowerCase()).toContain("do not");   // the anti-speculation guard
  });
  it("parses the gateway chat-completion content, or null", () => {
    expect(parseSummaryResponse({ choices: [{ message: { content: "  A summary.  " } }] })).toBe("A summary.");
    expect(parseSummaryResponse({ choices: [] })).toBeNull();
    expect(parseSummaryResponse({})).toBeNull();
    expect(parseSummaryResponse(null)).toBeNull();
  });
});
