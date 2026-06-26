import { expect, test } from "@playwright/test";

test("homepage renders the globe and a non-zero camera count", async ({ page }) => {
  await page.goto("/");
  // Globe.GL renders into a <canvas>
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const stat = page.getByTestId("stat-line");
  await expect(stat).toContainText(/cameras/i, { timeout: 30_000 });
  await expect(stat).not.toContainText("0 cameras");
});
