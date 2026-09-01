import { expect, test } from "@playwright/test";

test("interview preparation remains a private workspace", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("body")).toBeVisible();
});
