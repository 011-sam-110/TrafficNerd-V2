// lib/news/synthesis.ts
// Pure prompt builder + response parser for cross-source AI synthesis: given the
// headlines (and snippets) several outlets ran on the SAME event, ask a neutral
// editor to state the shared consensus and flag any discrepancies. Mirrors
// lib/news/summary.ts — honesty-guarded, node-testable; the network call lives in
// the route. Grounded ONLY in the supplied headlines (no article fetch, so no
// SSRF surface). Dormant-safe upstream when no gateway is configured.

export interface SynthesisSource {
  source: string;
  title: string;
  description?: string;
}

export interface SynthesisInput {
  title: string;
  sources: SynthesisSource[];
}

export interface SynthesisPayload {
  synthesis: string | null;
  dormant: boolean;
  sourceCount: number;
}

/** Pure: cluster headlines → the chat prompt sent to the gateway. */
export function buildSynthesisPrompt(input: SynthesisInput): string {
  const lines = input.sources.map((s, i) => {
    const snip = s.description ? ` — ${s.description}` : "";
    return `${i + 1}. [${s.source}] ${s.title}${snip}`;
  });
  return [
    "You are a neutral news desk editor. Several outlets are covering the same event.",
    "Below are their headlines (and any snippets). In 3-4 short, factual sentences:",
    "first state the consensus — what all the sources agree happened; then note any",
    "discrepancies, differing emphasis, or details only some outlets report.",
    "Use ONLY the text provided. Do not add facts, figures, or opinions not present in it. Do not speculate.",
    "",
    `Event: ${input.title}`,
    "",
    "Coverage:",
    ...lines,
  ].join("\n");
}

/** Pure: gateway chat-completion response → synthesis text, or null. */
export function parseSynthesisResponse(json: unknown): string | null {
  const content = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

/** Stable cache key for a synthesis request (order-independent over sources). */
export function synthesisKey(input: SynthesisInput): string {
  const parts = input.sources.map((s) => `${s.source}:${s.title}`).sort();
  return `${input.title}|${parts.join("|")}`;
}
