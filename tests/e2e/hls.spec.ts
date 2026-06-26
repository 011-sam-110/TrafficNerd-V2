import { expect, test } from "@playwright/test";

test("the HLS proxy rejects missing params and disallowed hosts", async ({ request }) => {
  expect((await request.get("/api/hls")).status()).toBe(400);
  const forbidden = await request.get("/api/hls?u=" + encodeURIComponent("https://evil.example.com/x.m3u8"));
  expect(forbidden.status()).toBe(403);
});

test("a US camera's stream is proxied as an HLS playlist", async ({ request }) => {
  const { cameras } = await (await request.get("/api/cameras")).json();
  const us = cameras.find((c: { id: string }) => c.id.startsWith("caltrans:") || c.id.startsWith("scdot:"));
  test.skip(!us, "no US camera available from live sources right now");
  const res = await request.get(`/api/hls?id=${encodeURIComponent(us.id)}`);
  // Live streams flake; accept a proxied playlist (200 mpegurl) or an upstream-down 502.
  if (res.ok()) {
    expect(res.headers()["content-type"]).toContain("mpegurl");
    expect(await res.text()).toContain("/api/hls?u=");
  } else {
    expect([502, 404]).toContain(res.status());
  }
});
