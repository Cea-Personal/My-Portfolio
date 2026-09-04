import { expect, test } from "@playwright/test";

test("public portfolio exposes semantic section anchors", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-intro")).toBeHidden();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("#projects")).toBeVisible();
  await expect(page.locator("#impact")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "The journey, company by company." })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A few things I've made curious on purpose." })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This portfolio is part of the work." })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Notes from making solutions/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Data.*Engineer/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-portfolio-theme", "light");
  await expect(page.locator(".hero-name")).toHaveCSS("color", "rgb(16, 21, 31)");
  const careerChapters = page.locator(".career-accordion button strong");
  if (await careerChapters.count()) {
    await expect(careerChapters.first()).toHaveCSS("color", "rgb(23, 32, 51)");
  }
  await expect(
    page.getByRole("heading", { name: "This portfolio is part of the work." })
  ).toHaveCSS("color", "rgb(23, 32, 51)");
  expect(
    await page
      .locator(".cinematic-hero h1")
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  expect(
    await page
      .locator(".cinematic-hero")
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  const portrait = page.getByRole("img", { name: "Portrait of Basil Ogbonna" });
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute("src", "/images/basil-ogbonna.jpg");
  expect(
    await portrait.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
  ).toBe(true);
  await expect(page.getByRole("link", { name: /owner login/i })).toHaveAttribute(
    "href",
    "/sign-in"
  );
  await expect(page.getByRole("heading", { name: "The work behind the outcome." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Basil Ogbonna profiles" })).toBeVisible();
  await page.getByRole("tab", { name: "Data engineering" }).click();
  await expect(page.getByLabel("Data engineering process snippet")).toContainText("data_contract");
  await expect(page.locator("#about")).toHaveAttribute("data-reveal", /visible|pending/);
  if (await careerChapters.count()) {
    await page.getByRole("button", { name: /01 web developer/i }).click();
    await expect(page.locator(".career-accordion-detail")).toBeVisible();
    await expect(page.getByRole("button", { name: /01 web developer/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  }
  await expect(page.getByRole("link", { name: /explore basil's career journey/i })).toHaveAttribute(
    "href",
    "#experience"
  );
});
