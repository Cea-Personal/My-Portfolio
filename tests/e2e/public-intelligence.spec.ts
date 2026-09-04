import { expect, test } from "@playwright/test";

test("public intelligence controls render without private context", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ask Basil" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "How do I fit?" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "What data systems has Basil built?" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "How do I fit?" }).click();
  await page.locator("#match summary").click();
  await expect(page.getByLabel("Role description")).toBeVisible();
  await expect(page.locator("#about")).toHaveAttribute("data-reveal", /visible|pending/);
  await page.getByRole("tab", { name: "Ask the portfolio" }).click();
  await page.getByRole("button", { name: "What data systems has Basil built?" }).click();
  await expect(page.locator(".assistant-user-message")).toContainText("What data systems");
});
