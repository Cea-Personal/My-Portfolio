import { expect, test } from "@playwright/test";

test("public intelligence controls render without private context", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /ask basil's portfolio/i })).toBeVisible();
  await expect(page.getByText("How do I fit this role?", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "What data systems has Basil built?" })
  ).toBeVisible();
  await expect(page.locator("#ask #match")).toHaveCount(1);
  await page.locator("#ask #match summary").click();
  await expect(page.getByLabel("Role description")).toBeVisible();
  await expect(page.locator("#about")).toHaveAttribute("data-reveal", /visible|pending/);
  await page.getByRole("button", { name: "What data systems has Basil built?" }).click();
  await expect(page.locator(".assistant-user-message")).toContainText("What data systems");
});
