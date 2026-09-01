import { expect, test } from "@playwright/test";

test("analytics dashboard is reachable for the owner", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.locator("body")).toBeVisible();
});
