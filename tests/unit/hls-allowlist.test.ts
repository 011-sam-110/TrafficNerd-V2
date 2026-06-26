import { expect, test } from "vitest";
import { isHlsAllowed } from "@/lib/proxy/hls-allowlist";

test("allows Caltrans wzmedia with the Caltrans referer", () => {
  const v = isHlsAllowed(new URL("https://wzmedia.dot.ca.gov/D11/CAM.stream/playlist.m3u8"));
  expect(v.ok).toBe(true);
  expect(v.referer).toBe("https://cwwp2.dot.ca.gov/");
});
test("allows SC skyvdn shards under /rtplive/ with the 511sc referer", () => {
  const v = isHlsAllowed(new URL("https://s19.us-east-1.skyvdn.com:443/rtplive/50001/playlist.m3u8"));
  expect(v.ok).toBe(true);
  expect(v.referer).toBe("https://www.511sc.org/");
});
test("rejects a skyvdn path outside /rtplive/", () => {
  expect(isHlsAllowed(new URL("https://s19.us-east-1.skyvdn.com/secret/x.m3u8")).ok).toBe(false);
});
test("rejects unknown hosts, look-alike suffixes, and non-http", () => {
  expect(isHlsAllowed(new URL("https://evil.example.com/x.m3u8")).ok).toBe(false);
  expect(isHlsAllowed(new URL("https://x.us-east-1.skyvdn.com.attacker.com/rtplive/x")).ok).toBe(false);
  expect(isHlsAllowed(new URL("file:///etc/passwd")).ok).toBe(false);
});
