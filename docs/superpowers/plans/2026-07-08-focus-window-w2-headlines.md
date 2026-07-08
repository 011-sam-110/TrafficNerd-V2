# Focus Window — W2: Headlines detail + on-demand AI article summary

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The Headlines widget's focus view becomes a newsroom board — full grouped feed with RSS snippets, source filter + search, an hourly volume strip, and a per-article **on-demand AI summary** that fetches the full article server-side (dormant until `FREELLMAPI_*`, honest fallback to the snippet).

**Architecture:** Reuse the W1 focus foundation (`WidgetType.detail`, `StageHost`, `<Chart>`, `buckets`). Extend the keyless RSS parser to capture `<description>`. Add a dormant-safe `/api/news/summary` route modelled exactly on `/api/brief` (pure prompt builder + gateway call), guarded by a **news-specific SSRF allowlist** (the existing `isAllowed` is camera-hosts only). The detail view reuses the widget's existing `useJsonPoll("/api/news")` data.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, vitest. **No new dependencies.**

## Global Constraints

- **Build gate (every task):** `npx tsc --noEmit && npm test`
- **Keyless-first / dormant-safe:** the AI summary is the only key-gated piece — dormant (`{summary:null, dormant:true}`) until `FREELLMAPI_BASE_URL`+`FREELLMAPI_KEY`; every failure returns JSON, never a 5xx. Snippets are keyless.
- **SSRF:** `/api/news/summary` fetches a URL server-side — it MUST validate the URL against a news-publisher allowlist before fetching (the existing `lib/proxy/allowlist.ts` `isAllowed` is for camera hosts and must NOT be reused here).
- **Back-compat:** `NewsItem.description` is OPTIONAL — `NewsTicker`, `BreakingBanner`, and the docked Headlines widget must keep working unchanged.
- **Zero new deps**; native SVG + hand-rolled parsing (repo convention).
- **Commit style:** one commit per task, `<type>: <summary>`, `git commit -m "..."` with plain double quotes (NOT a `@'...'` heredoc), **solo attribution — NO Claude co-author trailer**.
- **Styling:** real `tn-*` tokens only — `--tn-surface`/`--tn-surface-solid`/`--tn-surface-2`/`--tn-text`/`--tn-text-muted`/`--tn-text-faint`/`--tn-border`/`--tn-accent` (do NOT invent `--tn-*-1` names).
- **Honesty:** an AI summary is labelled AI-generated; a blocked/paywalled fetch falls back to the RSS snippet with an honest note; never fabricate article content.

---

## File Structure

- Modify `lib/news.ts` — capture `<description>` into `NewsItem.description?`.
- Create `lib/news/article.ts` + test — news-host SSRF allowlist + readability text extraction (pure).
- Create `lib/news/summary.ts` + test — AI summary prompt builder + response parser (pure).
- Create `app/api/news/summary/route.ts` — dormant-safe summary route (impure shell).
- Create `lib/console/widgets/headlines.detail.tsx` — the focus view (built up across Tasks 5–8).
- Modify `lib/console/widgets/headlines.tsx` — attach `detail`.
- Modify `app/globals.css` — `.tn-hd*` styles (appended across Tasks 5–8).

---

## Task 1: Capture RSS `<description>` (keyless snippet)

**Files:**
- Modify: `lib/news.ts`
- Test: `tests/unit/news-description.test.ts`

**Interfaces:**
- Produces: `NewsItem.description?: string` (cleaned snippet), populated by `parseRss`; rides through `mergeNews` unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/news-description.test.ts
import { describe, it, expect } from "vitest";
import { parseRss } from "@/lib/news";

const XML = `<rss><channel>
  <item>
    <title>Big story &amp; more</title>
    <link>https://www.bbc.com/news/world-123</link>
    <pubDate>Wed, 08 Jul 2026 08:00:00 GMT</pubDate>
    <description><![CDATA[<p>A short <b>summary</b> of the story.</p>]]></description>
  </item>
  <item>
    <title>No description here</title>
    <link>https://www.bbc.com/news/world-124</link>
  </item>
</channel></rss>`;

describe("parseRss description", () => {
  it("captures a cleaned <description> snippet", () => {
    const items = parseRss(XML, "BBC");
    expect(items[0].description).toBe("A short summary of the story.");
  });
  it("leaves description undefined when the item has none", () => {
    const items = parseRss(XML, "BBC");
    expect(items[1].description).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/news-description.test.ts`
Expected: FAIL — `description` is `undefined` on item[0].

- [ ] **Step 3: Implement**

In `lib/news.ts`, add the optional field to the interface:

```ts
export interface NewsItem {
  title: string;
  source: string;
  url: string;
  ts: number; // epoch ms (0 when the feed omits a parseable date)
  /** Cleaned RSS <description>/<summary> snippet, when the feed provides one. */
  description?: string;
}
```

In `parseRss`, inside the `for (const block of blocks)` loop, after computing `title`/`url` and before `out.push(...)`, derive the description and include it:

```ts
    const title = cleanText(tag(block, "title"));
    const url = extractLink(block);
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const descRaw = tag(block, "description") ?? tag(block, "summary");
    const description = cleanText(descRaw) || undefined;
    out.push({ title, source, url: url.trim(), ts: parseDate(block), description });
```

(`cleanText` already strips CDATA, tags, and entities. `mergeNews` pushes each `NewsItem` as-is, so `description` carries through automatically.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/news-description.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add lib/news.ts tests/unit/news-description.test.ts
git commit -m "feat(news): capture RSS <description> snippet on NewsItem (keyless, back-compatible)"
```

---

## Task 2: News-host SSRF allowlist + article text extraction

**Files:**
- Create: `lib/news/article.ts`
- Test: `tests/unit/news-article.test.ts`

**Interfaces:**
- Produces:
  - `isNewsArticleUrl(raw: string): boolean` — true only for https URLs on an allowlisted news-publisher domain (or subdomain).
  - `extractArticleText(html: string, maxChars?: number): string` — strips scripts/styles/tags, collapses whitespace, caps length; returns `""` when nothing usable.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/news-article.test.ts
import { describe, it, expect } from "vitest";
import { isNewsArticleUrl, extractArticleText } from "@/lib/news/article";

describe("isNewsArticleUrl", () => {
  it("allows the known publisher domains + subdomains over https", () => {
    expect(isNewsArticleUrl("https://www.bbc.com/news/world-123")).toBe(true);
    expect(isNewsArticleUrl("https://www.theguardian.com/world/x")).toBe(true);
    expect(isNewsArticleUrl("https://text.npr.org/12345")).toBe(true);
    expect(isNewsArticleUrl("https://www.aljazeera.com/news/x")).toBe(true);
  });
  it("rejects other hosts, non-https, and junk", () => {
    expect(isNewsArticleUrl("https://evil.example.com/x")).toBe(false);
    expect(isNewsArticleUrl("http://www.bbc.com/news/x")).toBe(false); // must be https
    expect(isNewsArticleUrl("not a url")).toBe(false);
    expect(isNewsArticleUrl("https://notbbc.com.evil.com/x")).toBe(false);
  });
});

describe("extractArticleText", () => {
  it("strips scripts/styles/markup and collapses whitespace", () => {
    const html = `<html><head><style>.x{}</style><script>bad()</script></head>
      <body><h1>Title</h1><p>First para.</p><p>Second   para.</p></body></html>`;
    const text = extractArticleText(html);
    expect(text).toContain("First para.");
    expect(text).toContain("Second para.");
    expect(text).not.toContain("bad()");
    expect(text).not.toContain(".x{}");
  });
  it("caps length and returns empty for blank input", () => {
    expect(extractArticleText("")).toBe("");
    expect(extractArticleText("<p>" + "a".repeat(50000) + "</p>", 100).length).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/news-article.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/news-article.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/news/article.ts tests/unit/news-article.test.ts
git commit -m "feat(news): news-host SSRF allowlist + readability text extraction (pure)"
```

---

## Task 3: AI summary prompt builder + response parser

**Files:**
- Create: `lib/news/summary.ts`
- Test: `tests/unit/news-summary.test.ts`

**Interfaces:**
- Produces:
  - `SummaryInput { title: string; source: string; text: string }`
  - `buildSummaryPrompt(input: SummaryInput): string`
  - `parseSummaryResponse(json: unknown): string | null`
  - `SummaryPayload { summary: string | null; dormant: boolean; source: "ai" | "snippet" | null }`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/news-summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/news-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/news/summary.ts tests/unit/news-summary.test.ts
git commit -m "feat(news): AI summary prompt builder + response parser (pure, honesty-guarded)"
```

---

## Task 4: `/api/news/summary` route (dormant-safe)

**Files:**
- Create: `app/api/news/summary/route.ts`

**Interfaces:**
- Consumes: `isNewsArticleUrl`, `extractArticleText` (Task 2); `buildSummaryPrompt`, `parseSummaryResponse`, `SummaryPayload` (Task 3); `freellmConfig` (`@/lib/geolocate/config`).
- Produces: `POST /api/news/summary` `{ url, title, source }` → `SummaryPayload` JSON. Dormant when the gateway isn't configured; falls back to the caller's snippet flag when the fetch is blocked; never 5xx.

- [ ] **Step 1: Implement the route** (modelled on `app/api/brief/route.ts`)

```ts
// app/api/news/summary/route.ts
import { isNewsArticleUrl, extractArticleText } from "@/lib/news/article";
import { buildSummaryPrompt, parseSummaryResponse, type SummaryPayload } from "@/lib/news/summary";
import { freellmConfig } from "@/lib/geolocate/config";

export const dynamic = "force-dynamic";

// POST /api/news/summary { url, title, source } — on-demand AI summary of ONE article.
// Dormant ({summary:null, dormant:true}) until FREELLMAPI_* is set. SSRF-guarded to
// the news-publisher allowlist. Dormant-safe: any failure returns JSON, never a 5xx.
// Cached per-URL (module map) so re-opening a story is free.

const cache = new Map<string, SummaryPayload>();

function bad(): Response {
  return Response.json({ summary: null, dormant: false, source: null } satisfies SummaryPayload);
}

export async function POST(req: Request) {
  let body: { url?: unknown; title?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad();
  }
  const url = typeof body.url === "string" ? body.url : "";
  const title = typeof body.title === "string" ? body.title : "";
  const source = typeof body.source === "string" ? body.source : "";
  if (!isNewsArticleUrl(url)) return bad();

  const cached = cache.get(url);
  if (cached) return Response.json(cached);

  const cfg = freellmConfig();
  if (!cfg) {
    // Not cached — dormancy can change when the env is set.
    return Response.json({ summary: null, dormant: true, source: null } satisfies SummaryPayload);
  }

  let text = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TrafficNerd/2.0 (+github.com/011-sam-110/TrafficNerd-V2)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) text = extractArticleText(await res.text());
  } catch {
    text = "";
  }
  if (text.length < 200) {
    // Blocked / paywalled / too thin — tell the client to fall back to its snippet.
    const payload: SummaryPayload = { summary: null, dormant: false, source: "snippet" };
    return Response.json(payload);
  }

  try {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: buildSummaryPrompt({ title, source, text }) }],
        temperature: 0.2,
        max_tokens: 220,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    const summary = parseSummaryResponse(await r.json());
    const payload: SummaryPayload = { summary, dormant: false, source: summary ? "ai" : "snippet" };
    if (summary) cache.set(url, payload);
    return Response.json(payload);
  } catch {
    return Response.json({ summary: null, dormant: false, source: "snippet" } satisfies SummaryPayload);
  }
}
```

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit && npm test`
Expected: clean + all tests pass (route has no unit test; its pure deps are covered by Tasks 2–3; behaviour is verified live by the integrator).

- [ ] **Step 3: Commit**

```bash
git add app/api/news/summary/route.ts
git commit -m "feat(news): /api/news/summary — dormant-safe, SSRF-guarded on-demand article summary"
```

---

## Task 5: Headlines detail — control bar + grouped feed with snippets

**Files:**
- Create: `lib/console/widgets/headlines.detail.tsx`
- Modify: `lib/console/widgets/headlines.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `WidgetDetailProps` (registry); `useJsonPoll` (`@/lib/console/widgets/useJsonPoll`); `NewsItem` (`@/lib/news`); `countBy` (`@/lib/widgets/buckets`).
- Produces: `HeadlinesDetail(props: WidgetDetailProps)` default export, attached as `HEADLINES_WIDGET.detail`.

- [ ] **Step 1: Create the detail component**

```tsx
// lib/console/widgets/headlines.detail.tsx
"use client";
// Headlines focus view — a newsroom board. Reuses the SAME /api/news poll as the
// docked widget, rendering deep: source filter + search, a recency-grouped feed with
// snippets, an hourly volume strip (Task 6), on-demand AI summaries (Task 7), and a
// sources footer + export (Task 8).
import { useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import type { NewsItem } from "@/lib/news";
import { useJsonPoll } from "@/lib/console/widgets/useJsonPoll";
import { countBy } from "@/lib/widgets/buckets";

interface NewsPayload { generatedAt: number; items: NewsItem[] }
const EMPTY: NewsPayload = { generatedAt: 0, items: [] };
const SOURCES = ["BBC", "Al Jazeera", "NPR", "The Guardian"];

function rel(ts: number, now: number): string {
  if (!ts) return "";
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}
function bucketOf(ts: number, now: number): "Last hour" | "Today" | "Earlier" {
  const h = (now - ts) / 3_600_000;
  if (ts && h < 1) return "Last hour";
  if (ts && h < 24) return "Today";
  return "Earlier";
}
const BUCKET_ORDER = ["Last hour", "Today", "Earlier"] as const;

export default function HeadlinesDetail({ }: WidgetDetailProps) {
  const { data, status } = useJsonPoll<NewsPayload>("/api/news", 120_000, EMPTY);
  const items = useMemo(() => data.items ?? [], [data.items]);
  const [srcFilter, setSrcFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const now = Date.now();

  const counts = useMemo(() => countBy(items, (it) => it.source), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (it) =>
        (srcFilter == null || it.source === srcFilter) &&
        (!q || it.title.toLowerCase().includes(q) || (it.description ?? "").toLowerCase().includes(q)),
    );
  }, [items, srcFilter, query]);

  const groups = useMemo(() => {
    const by = new Map<string, NewsItem[]>();
    for (const it of filtered) {
      const b = bucketOf(it.ts, now);
      const g = by.get(b) ?? [];
      g.push(it);
      by.set(b, g);
    }
    return BUCKET_ORDER.filter((b) => by.has(b)).map((b) => [b, by.get(b)!] as const);
  }, [filtered, now]);

  return (
    <div className="tn-hd">
      <div className="tn-hd-bar">
        <div className="tn-hd-chips">
          <button className={srcFilter == null ? "is-on" : ""} onClick={() => setSrcFilter(null)}>All {items.length}</button>
          {SOURCES.map((s) => (
            <button key={s} className={srcFilter === s ? "is-on" : ""} onClick={() => setSrcFilter(s)}>{s} {counts[s] ?? 0}</button>
          ))}
        </div>
        <input className="tn-hd-search" placeholder="Search headlines…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {status === "loading" && items.length === 0 && <p className="tn-w-empty">Loading headlines…</p>}
      {items.length > 0 && filtered.length === 0 && <p className="tn-w-empty">No headlines match.</p>}

      {groups.map(([bucket, rows]) => (
        <section key={bucket} className="tn-hd-group">
          <h3 className="tn-hd-group-h">{bucket} · {rows.length}</h3>
          <ul className="tn-hd-list">
            {rows.map((it, i) => (
              <li key={it.url || i} className="tn-hd-item">
                <a className="tn-hd-title" href={it.url} target="_blank" rel="noreferrer">{it.title}</a>
                <div className="tn-hd-meta"><span className="tn-hd-src">{it.source}</span>{it.ts ? ` · ${rel(it.ts, now)}` : ""}</div>
                {it.description && <p className="tn-hd-snippet">{it.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Attach + style**

In `lib/console/widgets/headlines.tsx`, import and attach:

```tsx
import HeadlinesDetail from "@/lib/console/widgets/headlines.detail";
```

Add `detail: HeadlinesDetail` to `HEADLINES_WIDGET` (after `component: HeadlinesBody`).

Append to `app/globals.css`:

```css
.tn-hd { max-width: 1000px; margin: 0 auto; }
.tn-hd-bar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin-bottom: 12px; }
.tn-hd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tn-hd-chips button { font: inherit; font-size: 12px; padding: 3px 10px; border: 1px solid var(--tn-border); border-radius: 999px; background: transparent; color: var(--tn-text-muted); cursor: pointer; }
.tn-hd-chips button.is-on { background: var(--tn-accent); color: #fff; border-color: var(--tn-accent); }
.tn-hd-search { margin-left: auto; font: inherit; font-size: 13px; padding: 5px 10px; border: 1px solid var(--tn-border); border-radius: 6px; background: var(--tn-surface-2); color: var(--tn-text); min-width: 180px; }
.tn-hd-group { margin: 12px 0; }
.tn-hd-group-h { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--tn-text-faint); margin: 0 0 6px; }
.tn-hd-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.tn-hd-item { padding: 8px 10px; border-radius: 8px; background: var(--tn-surface-2); }
.tn-hd-title { font-weight: 600; color: var(--tn-text); text-decoration: none; }
.tn-hd-title:hover { text-decoration: underline; }
.tn-hd-meta { font-size: 11px; color: var(--tn-text-faint); margin-top: 2px; }
.tn-hd-src { color: var(--tn-accent); }
.tn-hd-snippet { font-size: 13px; color: var(--tn-text-muted); margin: 4px 0 0; }
```

- [ ] **Step 3: Gate + verify**

Run: `npx tsc --noEmit && npm test` → green. (Integrator verifies live: expand Headlines → source chips + counts, search filters, recency groups with snippets.)

- [ ] **Step 4: Commit**

```bash
git add lib/console/widgets/headlines.detail.tsx lib/console/widgets/headlines.tsx app/globals.css
git commit -m "feat(headlines): focus detail — source filter + search + recency-grouped feed with snippets"
```

---

## Task 6: Headlines detail — hourly volume strip

**Files:**
- Modify: `lib/console/widgets/headlines.detail.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `timeBins` (`@/lib/widgets/buckets`), `Chart`/`ChartPoint` (`@/components/Chart`).

- [ ] **Step 1: Add imports + derived data**

Add imports at the top:

```tsx
import { timeBins } from "@/lib/widgets/buckets";
import { Chart, type ChartPoint } from "@/components/Chart";
```

Inside the component, after `groups`:

```tsx
  const volume: ChartPoint[] = useMemo(() => {
    const ts = filtered.map((it) => it.ts).filter((n) => n > 0);
    return timeBins(ts, 60 * 60_000, now, 24 * 60 * 60_000).map((b) => ({ x: b.start, y: b.count }));
  }, [filtered, now]);
```

- [ ] **Step 2: Render the strip** (place immediately after the `.tn-hd-bar` block, before the loading/empty lines)

```tsx
      {volume.some((p) => p.y > 0) && (
        <div className="tn-hd-vol">
          <div className="tn-hd-group-h">Headlines per hour · last 24h</div>
          <Chart points={volume} height={80} up={null} />
        </div>
      )}
```

- [ ] **Step 3: Style**

Append to `app/globals.css`:

```css
.tn-hd-vol { background: var(--tn-surface-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; }
```

- [ ] **Step 4: Gate + commit**

Run: `npx tsc --noEmit && npm test` → green.

```bash
git add lib/console/widgets/headlines.detail.tsx app/globals.css
git commit -m "feat(headlines): focus detail — hourly headline-volume strip"
```

---

## Task 7: Headlines detail — on-demand AI summary

**Files:**
- Modify: `lib/console/widgets/headlines.detail.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `POST /api/news/summary` → `SummaryPayload` (Task 4).

- [ ] **Step 1: Add per-item summary state + fetcher** (inside the component)

```tsx
  type SumState = { loading?: boolean; text?: string; note?: string };
  const [summaries, setSummaries] = useState<Record<string, SumState>>({});
  const summarize = (it: NewsItem) => {
    if (summaries[it.url]?.loading || summaries[it.url]?.text) return;
    setSummaries((s) => ({ ...s, [it.url]: { loading: true } }));
    fetch("/api/news/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: it.url, title: it.title, source: it.source }),
    })
      .then((r) => r.json())
      .then((d: { summary: string | null; dormant: boolean; source: string | null }) => {
        const note = d.dormant
          ? "AI summary needs the FREELLMAPI gateway — showing the snippet."
          : d.summary
            ? undefined
            : "Couldn’t read this article — showing the snippet.";
        setSummaries((s) => ({ ...s, [it.url]: { text: d.summary ?? it.description ?? "No preview available.", note } }));
      })
      .catch(() => setSummaries((s) => ({ ...s, [it.url]: { text: it.description ?? "No preview available.", note: "Summary unavailable." } })));
  };
```

- [ ] **Step 2: Render the button + result** (inside each `<li className="tn-hd-item">`, after the snippet `<p>`)

```tsx
                <button className="tn-hd-sum-btn" onClick={() => summarize(it)} disabled={!!summaries[it.url]?.loading}>
                  {summaries[it.url]?.loading ? "Summarising…" : "✨ AI summary"}
                </button>
                {summaries[it.url]?.text && (
                  <div className="tn-hd-sum">
                    <p>{summaries[it.url]!.text}</p>
                    {summaries[it.url]!.note && <span className="tn-hd-sum-note">{summaries[it.url]!.note}</span>}
                  </div>
                )}
```

- [ ] **Step 3: Style**

Append to `app/globals.css`:

```css
.tn-hd-sum-btn { margin-top: 6px; font: inherit; font-size: 11px; padding: 2px 8px; border: 1px solid var(--tn-border); border-radius: 6px; background: transparent; color: var(--tn-accent); cursor: pointer; }
.tn-hd-sum-btn:disabled { opacity: .6; cursor: default; }
.tn-hd-sum { margin-top: 6px; padding: 8px 10px; border-left: 2px solid var(--tn-accent); background: var(--tn-surface); border-radius: 4px; }
.tn-hd-sum p { margin: 0; font-size: 13px; color: var(--tn-text); }
.tn-hd-sum-note { display: block; margin-top: 4px; font-size: 11px; color: var(--tn-text-faint); }
```

- [ ] **Step 4: Gate + commit**

Run: `npx tsc --noEmit && npm test` → green. (Integrator verifies live: clicking "✨ AI summary" with the gateway dormant shows the snippet + the honest "needs the FREELLMAPI gateway" note.)

```bash
git add lib/console/widgets/headlines.detail.tsx app/globals.css
git commit -m "feat(headlines): focus detail — on-demand AI article summary (dormant-safe, snippet fallback)"
```

---

## Task 8: Headlines detail — sources footer + CSV export

**Files:**
- Modify: `lib/console/widgets/headlines.detail.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `toCsv`, `downloadText`, `exportFilename` (`@/lib/export`).

- [ ] **Step 1: Add import + export rows** (inside the component)

```tsx
  const exportRows = useMemo(
    () => filtered.map((it) => ({ source: it.source, title: it.title, url: it.url, ts: it.ts, description: it.description ?? "" })),
    [filtered],
  );
```

Add the import at the top:

```tsx
import { toCsv, downloadText, exportFilename } from "@/lib/export";
```

- [ ] **Step 2: Render the footer** (last child of the outer `.tn-hd` div)

```tsx
      <footer className="tn-hd-foot">
        <span className="tn-hd-foot-src">BBC World · Al Jazeera · NPR · The Guardian — keyless RSS</span>
        <button className="tn-hd-export" disabled={exportRows.length === 0}
          onClick={() => downloadText(`${exportFilename("headlines", Date.now())}.csv`, "text/csv", toCsv(exportRows))}>
          ⬇ Export CSV
        </button>
      </footer>
```

- [ ] **Step 3: Style**

Append to `app/globals.css`:

```css
.tn-hd-foot { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--tn-border); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.tn-hd-foot-src { font-size: 12px; color: var(--tn-text-faint); }
.tn-hd-export { margin-left: auto; font: inherit; font-size: 12px; padding: 4px 10px; border: 1px solid var(--tn-border); border-radius: 6px; background: transparent; color: var(--tn-accent); cursor: pointer; }
.tn-hd-export:disabled { opacity: .4; cursor: default; }
```

- [ ] **Step 4: Final gate + milestone screenshot**

Run: `npx tsc --noEmit && npm test` → green. Integrator screenshots the full Headlines detail to `persona-shots/focus-headlines-final.png`.

```bash
git add lib/console/widgets/headlines.detail.tsx app/globals.css
git commit -m "feat(headlines): focus detail — sources footer + CSV export"
```

---

## Self-Review

**Spec coverage (§7.2 Headlines):** control bar (source chips + search) → Task 5; grouped feed with snippet → Tasks 1+5; on-demand AI full-article summary → Tasks 2+3+4+7; volume strip → Task 6; sources footer + export → Task 8. RSS `<description>` capture → Task 1. **Deferred with intent:** the cross-source *"also covered by"* cluster (spec §7.2 panel 3) needs `mergeNews` to stop discarding title-duplicates and return the related items — a change to a shared function used by `NewsTicker`/`BreakingBanner`; it's a follow-up to avoid regressing them this pass. Optional RSS thumbnail/category capture also deferred (not needed for the core value).

**Placeholder scan:** none — every step has real code/commands.

**Type consistency:** `NewsItem.description?` (Task 1) used by Tasks 5/7/8; `SummaryPayload {summary,dormant,source}` shared by Tasks 3/4/7; `isNewsArticleUrl`/`extractArticleText` (Task 2) consumed by Task 4; `buildSummaryPrompt`/`parseSummaryResponse` (Task 3) consumed by Task 4; `ChartPoint`/`timeBins` reused from the W1 foundation. CSS uses only real `tn-*` tokens.

**Honesty:** AI summary labelled; dormant + blocked paths both fall back to the snippet with an explicit note; SSRF-guarded to the publisher allowlist; keyless snippet always available.
