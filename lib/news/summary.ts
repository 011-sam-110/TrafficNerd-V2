// lib/news/summary.ts
// Pure prompt builder + response parser for the on-demand article summary.
// Mirrors lib/brief.ts: honesty-guarded, node-testable; the network call lives in
// the route. The summary is grounded ONLY in the supplied article text.

export interface SummaryInput {
  title: string;
  source: string;
  text: string;
}

export interface SummaryPayload {
  summary: string | null;
  dormant: boolean;
  /** where the text came from: the AI over the fetched article, the RSS snippet, or nothing. */
  source: "ai" | "snippet" | null;
}

/** Pure: article text → the chat prompt sent to the gateway. */
export function buildSummaryPrompt(input: SummaryInput): string {
  return [
    "You are a neutral news editor. Summarise the article below in 3 short, factual sentences.",
    "Use ONLY the article text provided. Do not add facts, figures, or opinions not present in it. Do not speculate.",
    "",
    `Headline: ${input.title}`,
    `Source: ${input.source}`,
    "",
    "Article text:",
    input.text,
  ].join("\n");
}

/** Pure: parse the gateway's chat-completion response → summary text, or null. */
export function parseSummaryResponse(json: unknown): string | null {
  const content = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}
