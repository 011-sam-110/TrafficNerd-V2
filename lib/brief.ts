// AI daily brief — turns the day's live signals into a short, calm written
// situation summary. The model call goes through freellmapi.co (Sampo's own
// OpenAI-compatible gateway), so it's key-gated: dormant until FREELLMAPI_BASE_URL
// + FREELLMAPI_KEY are set. The PROMPT BUILDER is pure and isomorphic so it
// unit-tests in node; the network call lives in the route.
//
// Honesty guard: the brief is built ONLY from real signal data we already show
// (the top of the Country Instability Index), and the prompt forbids speculation —
// it summarises what the data says, it does not invent events.

export interface BriefSnapshot {
  /** Top instability countries (country name + 0–100 score), already ranked. */
  topInstability: { country: string; score: number }[];
  /** ISO date the snapshot was taken (optional, for the dateline). */
  dateIso?: string;
}

export interface BriefPayload {
  brief: string | null;
  dormant: boolean;
  generatedAt: number;
}

/** Pure: snapshot → the chat prompt sent to the gateway. */
export function buildBriefPrompt(s: BriefSnapshot): string {
  const list =
    s.topInstability.length > 0
      ? s.topInstability.map((c) => `${c.country} (${c.score}/100)`).join(", ")
      : "no countries currently above the instability threshold";
  const dateline = s.dateIso ? ` for ${s.dateIso}` : "";
  return [
    "You are a calm, factual intelligence analyst writing a short daily world brief" + dateline + ".",
    "Using ONLY the data below, write 3 short sentences summarising where global pressure is concentrated today.",
    "Do not invent specific events, casualty figures, or news the data does not contain. Do not speculate or give advice. Neutral, measured tone.",
    "",
    "Country Instability Index — highest-pressure countries right now: " + list + ".",
    "(The index composites armed conflict, food insecurity, forced displacement and internet outages; a higher score means more concurrent pressure.)",
  ].join("\n");
}

/** Pure: parse the gateway's chat-completion response → brief text, or null. */
export function parseBriefResponse(json: unknown): string | null {
  const choices = (json as { choices?: { message?: { content?: string } }[] })?.choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}
