import { expect, test } from "vitest";
import { rewritePlaylist } from "@/lib/proxy/hls-rewrite";

const BASE = "https://wzmedia.dot.ca.gov/D11/CAM.stream/playlist.m3u8";
const enc = (s: string) => encodeURIComponent(s);

test("rewrites a relative chunklist URI and leaves tag lines untouched", () => {
  const out = rewritePlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nchunklist_w1.m3u8\n", BASE);
  expect(out).toContain("#EXT-X-STREAM-INF:BANDWIDTH=1");
  expect(out).toContain("/api/hls?u=" + enc("https://wzmedia.dot.ca.gov/D11/CAM.stream/chunklist_w1.m3u8"));
});
test("rewrites relative .ts segments", () => {
  const out = rewritePlaylist("#EXTINF:2.0,\nmedia_w1_0.ts\n", BASE);
  expect(out).toContain("/api/hls?u=" + enc("https://wzmedia.dot.ca.gov/D11/CAM.stream/media_w1_0.ts"));
});
test("resolves absolute segment URIs", () => {
  const out = rewritePlaylist("#EXT-X-VERSION:3\nhttps://cdn.example.com/x/seg.ts\n", BASE);
  expect(out).toContain("#EXT-X-VERSION:3");
  expect(out).toContain("/api/hls?u=" + enc("https://cdn.example.com/x/seg.ts"));
});
test("rewrites the URI attribute of an EXT-X-KEY tag", () => {
  const out = rewritePlaylist('#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nmedia0.ts\n', BASE);
  expect(out).toContain("/api/hls?u=" + enc("https://wzmedia.dot.ca.gov/D11/CAM.stream/key.bin"));
});
