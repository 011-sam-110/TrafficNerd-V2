import { expect, test } from "vitest";
import { NEWS_PROVIDERS, parseCustomStream, resolveEmbed, providerThumb } from "@/lib/console/news/providers";

test("seeds at least 10 free providers with valid kinds", () => {
  expect(NEWS_PROVIDERS.length).toBeGreaterThanOrEqual(10);
  for (const p of NEWS_PROVIDERS) expect(["youtube", "hls"]).toContain(p.kind);
});

test("parseCustomStream reads a YouTube live URL", () => {
  const p = parseCustomStream("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  expect(p?.kind).toBe("youtube");
  expect(p?.ref).toBe("dQw4w9WgXcQ");
});

test("parseCustomStream reads an HLS url and rejects junk", () => {
  expect(parseCustomStream("https://x.com/live/stream.m3u8")?.kind).toBe("hls");
  expect(parseCustomStream("not a url")).toBeNull();
});

test("resolveEmbed builds a youtube embed src", () => {
  const e = resolveEmbed({ id: "x", name: "X", category: "World", kind: "youtube", ref: "dQw4w9WgXcQ" });
  expect(e.kind).toBe("youtube");
  expect(e.src).toContain("youtube.com/embed/dQw4w9WgXcQ");
  expect(e.src).toContain("autoplay=1");
  expect(e.src).toContain("mute=1");
  expect(e.src).toContain("playsinline=1");
});

test("resolveEmbed rejects a non-http(s) hls ref", () => {
  const e = resolveEmbed({ id: "x", name: "X", category: "Custom", kind: "hls", ref: "javascript:alert(1)" });
  expect(e.kind).toBe("hls");
  expect(e.src).toBeFalsy();
});

test("providerThumb returns a keyless YouTube thumb for youtube, null for hls", () => {
  expect(providerThumb({ id: "x", name: "X", category: "World", kind: "youtube", ref: "abc12345678" }))
    .toBe("https://img.youtube.com/vi/abc12345678/hqdefault.jpg");
  expect(providerThumb({ id: "y", name: "Y", category: "World", kind: "hls", ref: "https://h/s.m3u8" })).toBeNull();
});
