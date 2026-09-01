import { expect, test } from "@playwright/test";

test("application workspace is review-only", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByRole("button", { name: /submit/i })).toHaveCount(0);
});
