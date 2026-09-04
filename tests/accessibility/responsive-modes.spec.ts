import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow desktop", width: 1024, height: 768 },
  { name: "large desktop", width: 1440, height: 900 }
];

for (const viewport of viewports) {
  test(`${viewport.name} has no page overflow in light and dark modes`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate((selectedTheme) => {
        document.documentElement.dataset.portfolioTheme = selectedTheme;
      }, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        )
      ).toBe(true);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
    }
  });
}

test("200 percent zoom preserves essential content without horizontal overflow", async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(page.getByRole("heading", { name: /Data Engineer/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Let's talk" })).toBeAttached();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
});

test("keyboard and reduced-motion modes preserve navigation and role information", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Data Engineer" })).toBeVisible();
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("tab", { name: "How do I fit?" }).focus();
  await page.keyboard.press("Enter");
  await page.locator("#match summary").click();
  await expect(page.getByLabel("Role description")).toBeVisible();
});
