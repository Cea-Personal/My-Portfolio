import { expect, test } from "@playwright/test";

test("published writing detail route is reachable", async ({ page }) => {
  await page.goto("/blog/example");
  await expect(page.locator("body")).toBeVisible();
});
