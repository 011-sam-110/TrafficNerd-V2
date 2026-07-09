// lib/news/primary.ts
// Best-effort "primary source" detection. Surfaces when a headline appears to be
// built on an official/primary document (a government statement, press release,
// court ruling, treaty/whitepaper, sanctions list …) so an analyst can tell a
// first-hand document from downstream commentary. PURE + node-testable.
//
// Honesty: RSS gives us only title/description/url, so this is a HIGH-PRECISION
// heuristic — a direct link to an official domain, or specific documentary
// phrasing. When nothing strong matches we return null and the UI shows no tag
// (we never guess).

import type { NewsItem } from "@/lib/news";

export interface PrimarySource {
  kind: "official" | "statement" | "press-release" | "document";
  label: string;
}

// Official / primary-document domains. If a feed ever links straight to one of
// these, that's a first-hand source.
const OFFICIAL_HOST =
  /(^|\.)(gov|mil)(\.[a-z]{2})?$|(^|\.)(un|who|imf|worldbank|icj-cij|icc-cpi|nato|oecd|wto|iaea)\.(org|int)$|(^|\.)europa\.eu$|(^|\.)europarl\.europa\.eu$/i;

// Specific documentary phrasings (kept tight to stay high-precision).
const CUES: { re: RegExp; kind: PrimarySource["kind"]; label: string }[] = [
  { re: /\bpress release\b/i, kind: "press-release", label: "Press release" },
  { re: /\b(official statement|full statement|statement from|readout|communiqu[eé])\b/i, kind: "statement", label: "Official statement" },
  { re: /\b(white ?paper|treaty text|full text of the|resolution text|executive order|court (ruling|filing)|full ruling|sanctions list)\b/i, kind: "document", label: "Primary document" },
];

/** Pure: item → its primary-source tag, or null when there's no strong signal. */
export function detectPrimarySource(item: Pick<NewsItem, "title" | "description" | "url">): PrimarySource | null {
  // 1) A direct link to an official/primary domain is the strongest signal.
  try {
    const host = new URL(item.url).hostname.toLowerCase();
    if (OFFICIAL_HOST.test(host)) return { kind: "official", label: "Official source" };
  } catch {
    /* unparseable url — fall through to text cues */
  }
  // 2) Documentary phrasing in the title/description.
  const text = `${item.title ?? ""} ${item.description ?? ""}`;
  for (const c of CUES) if (c.re.test(text)) return { kind: c.kind, label: c.label };
  return null;
}
