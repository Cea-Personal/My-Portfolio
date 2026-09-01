import { expect, test } from "@playwright/test";

test("analytics redirects an unauthenticated visitor to sign in", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fanalytics/);
});
