import { expect, test } from "@playwright/test";

test("a camera detail page shows a proxied image and TfL attribution", async ({ page, request }) => {
  const res = await request.get("/api/cameras");
  expect(res.ok()).toBeTruthy();
  const { cameras } = await res.json();
  expect(cameras.length).toBeGreaterThan(0);
  const id: string = cameras[0].id;

  await page.goto(`/camera/${encodeURIComponent(id)}`);
  await expect(page.getByTestId("attribution")).toContainText("Powered by TfL Open Data");

  const img = page.locator(".camera-detail img");
  await expect(img).toBeVisible();
  // The proxy actually serves image bytes:
  const proxyRes = await request.get(`/api/proxy?id=${encodeURIComponent(id)}`);
  expect(proxyRes.ok()).toBeTruthy();
  expect(proxyRes.headers()["content-type"]).toContain("image");
});

test("the proxy rejects a request with no id", async ({ request }) => {
  const res = await request.get("/api/proxy");
  expect(res.status()).toBe(400);
});
