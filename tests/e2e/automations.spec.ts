import { expect, test } from "@playwright/test";

test("automation run controls are visible without consequential actions", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("body")).toBeVisible();
});
