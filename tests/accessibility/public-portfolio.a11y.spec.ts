import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public portfolio has no automated critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});
