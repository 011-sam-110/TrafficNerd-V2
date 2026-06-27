// Vision-LLM geolocation backend — the DEFAULT, always-on, keyless path.
//
// Sends the photo to Sampo's freellmapi.co gateway (OpenAI-compatible: vision via
// an image_url content part, model "auto") and asks it to reason about
// architecture / signage / vegetation / road furniture and return strict JSON.
// The gateway key stays server-side. Accuracy is "informed guess" grade — much
// weaker than a real geo-embedding model — so the UI labels it honestly.

import { freellmConfig, BackendNotConfiguredError } from "./config";
import { parseLlmResponse } from "./normalize";
import { toImageUrlValue, type ImageInput } from "./image";
import type { RawCandidate } from "./types";

const SYSTEM_PROMPT =
  "You are an expert photo geolocator (like a GeoGuessr world champion). " +
  "From visual evidence only — architecture, road markings and signs, license plates, " +
  "vegetation, terrain, language on signage, driving side, utility poles, sky/sun — " +
  "estimate where the photo was most likely taken. Be calibrated: if evidence is weak, " +
  "say so with low confidence and broaden to country/region rather than inventing a street.";

const USER_PROMPT =
  "Identify the most likely location of this photo. Return ONLY a JSON object, no prose, " +
  'in exactly this shape:\n' +
  '{"candidates":[{"place":"<specific place or area>","country":"<country>",' +
  '"lat":<number>,"lon":<number>,"confidence":<0..1>,"reasoning":"<short why>"}]}\n' +
  "Give 1–5 candidates ranked most-to-least likely. Use decimal lat/lon. If you can only " +
  "name a city/country, give that place name and its approximate centre coordinates.";

/** Call the vision gateway and parse ranked candidates. Throws
 *  BackendNotConfiguredError when the gateway env vars are unset (route → clean
 *  message), and a plain Error on an upstream failure (route → 502-style JSON). */
export async function locateWithLlm(img: ImageInput, limit = 5): Promise<RawCandidate[]> {
  const cfg = freellmConfig();
  if (!cfg) {
    throw new BackendNotConfiguredError(
      "Vision-AI geolocation is not configured. Set FREELLMAPI_BASE_URL and FREELLMAPI_KEY " +
        "to enable the keyless vision backend.",
    );
  }

  const body = {
    model: cfg.model,
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          { type: "image_url", image_url: { url: toImageUrlValue(img) } },
        ],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new Error("The vision-AI gateway did not respond. Try again shortly.");
  }
  if (!res.ok) {
    throw new Error(`The vision-AI gateway returned an error (${res.status}).`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("The vision-AI gateway returned a malformed response.");
  }

  const content = extractContent(json);
  return parseLlmResponse(content, { limit });
}

/** Pull the assistant text out of an OpenAI-style chat completion (content can be
 *  a string or an array of content parts on some gateways). */
function extractContent(json: unknown): string {
  const choice = (json as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : ""))
      .join("\n");
  }
  return "";
}
