// Keyless Telegram channel → NewsItem[]. Telegram serves a public, keyless web
// preview of any public channel at https://t.me/s/<channel> (plain HTML, no API,
// no key, no login). We scrape that, exactly like the RSS parser scrapes XML — a
// small tag-scanning parser (no DOMParser, no deps), pure + node-testable against
// a captured fixture.
//
// PROVENANCE: a Telegram channel is an UNVERIFIED, self-published source (not a
// vetted newswire). We attribute it honestly via lib/news/sources.ts (type
// "OSINT monitor") and never present it as corroborated. Each post links out to
// the poster's own article when it carries one, else to the Telegram permalink.

import type { NewsItem } from "@/lib/news";

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => {
      const n = Number(d);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** Message text HTML → plain headline: drop <a>…</a> (the trailing source URL that
 *  Telegram renders as link text), strip remaining tags, decode entities, collapse. */
function cleanText(rawHtml: string): string {
  let s = rawHtml.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " "); // link + its URL-as-text
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<[^>]+>/g, " "); // any remaining inline markup (<b>, <i>, <tg-emoji>…)
  s = decodeEntities(s);
  return s.replace(/\s+/g, " ").trim();
}

/** Parse one message block (between two data-post anchors) → NewsItem, or null when
 *  it carries no text (media-only posts are skipped, like parseRss skips no-title). */
function parseBlock(block: string, post: string, source: string): NewsItem | null {
  const textM = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!textM) return null;
  const rawText = textM[1];

  // Prefer the first embedded external article link (liveuamap posts append the
  // source story), but never a t.me link — that's the permalink, handled below.
  const linkM = rawText.match(/<a\b[^>]*href="(https?:\/\/[^"]+)"/i);
  const articleUrl = linkM && !/^https?:\/\/(t\.me|telegram\.(me|org))\//i.test(linkM[1])
    ? decodeEntities(linkM[1])
    : undefined;

  const title = cleanText(rawText);
  if (!title) return null;

  const timeM = block.match(/<time[^>]*datetime="([^"]+)"/i);
  const parsed = timeM ? Date.parse(timeM[1]) : NaN;
  const ts = Number.isFinite(parsed) ? parsed : 0;

  const permalink = `https://t.me/${post}`; // post = "channel/123"
  return { title, source, url: articleUrl ?? permalink, ts };
}

/**
 * Pure: a t.me/s/<channel> HTML page → NewsItem[]. Slices the document into
 * per-message blocks on each `data-post="channel/123"` anchor. Never throws;
 * empty/garbage input → []. `source` is the display name (e.g. "Liveuamap").
 */
export function parseTelegram(html: string | null | undefined, source: string): NewsItem[] {
  if (!html) return [];
  const anchors: { post: string; start: number }[] = [];
  const re = /data-post="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) anchors.push({ post: m[1], start: m.index });

  const out: NewsItem[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const end = i + 1 < anchors.length ? anchors[i + 1].start : html.length;
    const item = parseBlock(html.slice(anchors[i].start, end), anchors[i].post, source);
    if (item) out.push(item);
  }
  return out;
}
