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
