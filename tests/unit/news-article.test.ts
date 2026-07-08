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
