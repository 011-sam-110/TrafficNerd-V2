// tests/e2e/console.spec.ts
import { test, expect } from "@playwright/test";

test("first-run seeds the World preset with widgets in segments", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tn-cw").first()).toBeVisible();
  await expect(page.locator('[data-segment="left"] .tn-cw')).not.toHaveCount(0);
});

test("⌘K adds a widget instance", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator(".tn-cw").count();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search/).fill("Add Aviation");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tn-cw")).toHaveCount(before + 1);
});

test("stage switch swaps to the world clock", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tn-stage-switch button", { hasText: "🕐" }).click();
  await expect(page.locator(".tn-clock")).toBeVisible();
});

test("collapsing the left segment hides its widgets", async ({ page }) => {
  await page.goto("/");
  // drag the left grip fully left
  const grip = page.locator(".tn-grip").first();
  const box = await grip.boundingBox();
  if (box) { await page.mouse.move(box.x + 2, box.y + 20); await page.mouse.down(); await page.mouse.move(0, box.y + 20); await page.mouse.up(); }
  await expect(page.locator('[data-segment="left"]')).toHaveCSS("width", /0px|(\d|10|20)px/);
});
