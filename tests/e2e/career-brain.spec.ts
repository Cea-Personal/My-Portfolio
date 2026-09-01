import { test, expect } from "@playwright/test";

test("public shell has a main landmark", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
});
