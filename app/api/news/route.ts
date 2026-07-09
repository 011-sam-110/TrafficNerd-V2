import { parseRss, mergeNews, type NewsItem, type NewsPayload } from "@/lib/news";

export const dynamic = "force-dynamic";

// GET /api/news — a merged, de-duplicated headline stream from a few reputable,
// keyless world-news RSS feeds, parsed server-side (no client XML, no key). A
// short server cache (≥5 min) keeps it light. Dormant-safe: each feed is fetched
// independently and a dead/slow one is simply skipped (never a 5xx).

interface Feed {
  url: string;
  source: string;
}

// All six confirmed live (RSS/RDF 2026-07-09). A dead one drops out silently.
// The extra European broadcasters (DW, France 24) widen cross-source story
// clustering and give the region/type facet matrix real diversity.
const FEEDS: Feed[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR" },
  { url: "https://www.theguardian.com/world/rss", source: "The Guardian" },
  { url: "https://rss.dw.com/rdf/rss-en-world", source: "DW" },
  { url: "https://www.france24.com/en/rss", source: "France 24" },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
// Higher than the docked list needs on purpose: the focus view clusters these
// into stories, so more raw material = richer, better-corroborated mega-cards.
const LIMIT = 60;

let cache: NewsPayload | null = null;

async function fetchFeed(feed: Feed): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    return parseRss(await res.text(), feed.source);
  } catch {
    return []; // a dead feed contributes nothing
  }
}

export async function GET() {
  if (cache && Date.now() - cache.generatedAt < CACHE_TTL_MS) {
    return Response.json(cache);
  }
  const lists = await Promise.all(FEEDS.map(fetchFeed));
  const items = mergeNews(lists, LIMIT);
  // Keep the last good list if a transient outage emptied everything.
  if (items.length === 0 && cache && cache.items.length > 0) {
    return Response.json(cache);
  }
  cache = { generatedAt: Date.now(), items };
  return Response.json(cache);
}
