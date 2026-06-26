import { expect, test } from "@playwright/test";

test("homepage renders the globe and a non-zero camera count", async ({ page }) => {
  await page.goto("/");
  // Globe.GL renders into a <canvas>
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const stat = page.getByTestId("stat-line");
  // Regex avoids the substring trap where e.g. "870 cameras" contains "0 cameras".
  await expect(stat).toContainText(/[1-9]\d* cameras/, { timeout: 30_000 });
});

test("the Earth texture is served locally (guards the black-globe regression)", async ({
  request,
}) => {
  // The globe was once black because the texture came from an external CDN
  // whose redirect chain three.js couldn't follow. The texture is now a local
  // static asset; this asserts it actually serves so a missing/renamed file
  // (which would render a black sphere) fails the suite instead of passing it.
  const res = await request.get("/textures/earth-night.jpg");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("image");
});
