// lib/news/article.ts
// SSRF guard + lightweight readability for the AI-summary route. Pure + node-testable.
// The allowlist is the news PUBLISHERS behind the /api/news feeds (article links live
// on the publisher's main domain, e.g. bbc.com — NOT the feeds.* host). This is a
// SEPARATE list from lib/proxy/allowlist.ts (which is camera hosts only).

const NEWS_DOMAINS = ["bbc.com", "bbc.co.uk", "theguardian.com", "aljazeera.com", "npr.org"];

/** https + hostname is one of NEWS_DOMAINS or a subdomain of one. */
export function isNewsArticleUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return NEWS_DOMAINS.some((d) => host === d || host.endsWith("." + d));
}

/** Strip scripts/styles/all tags, decode a few entities, collapse whitespace, cap length. */
export function extractArticleText(html: string, maxChars = 6000): string {
  if (!html) return "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
}
