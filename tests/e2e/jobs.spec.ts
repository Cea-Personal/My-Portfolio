import { expect, test } from "@playwright/test";

test("jobs workspace is reachable", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("body")).toBeVisible();
});
