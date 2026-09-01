import { test, expect } from "@playwright/test";

test("sign-in page is reachable", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
