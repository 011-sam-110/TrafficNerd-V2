// Rewrite an HLS playlist so every nested URI routes back through /api/hls.
// Relative URIs are resolved against the upstream playlist URL first.
export function rewritePlaylist(body: string, upstreamUrl: string): string {
  const proxy = (abs: string) => `/api/hls?u=${encodeURIComponent(abs)}`;
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;
      if (trimmed.startsWith("#")) {
        // Tags like EXT-X-KEY / EXT-X-MAP can carry URI="...".
        const m = trimmed.match(/URI="([^"]+)"/);
        if (m) {
          const abs = new URL(m[1], upstreamUrl).toString();
          return line.replace(m[1], proxy(abs));
        }
        return line;
      }
      const abs = new URL(trimmed, upstreamUrl).toString();
      return proxy(abs);
    })
    .join("\n");
}
