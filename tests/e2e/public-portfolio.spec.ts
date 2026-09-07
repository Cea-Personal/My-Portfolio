import { expect, test } from "@playwright/test";

test("public portfolio exposes semantic section anchors", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-intro")).toBeHidden();
  const portfolioMain = page.locator("main.portfolio-main");
  await expect(portfolioMain).toBeVisible();
  const mainBox = await portfolioMain.boundingBox();
  const viewport = page.viewportSize();
  expect(mainBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(mainBox?.x).toBeCloseTo(0, 0);
  expect(mainBox?.width).toBeCloseTo(viewport?.width ?? 0, 0);
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

test("mobile portfolio keeps navigation visible and moves the profile below the hero", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Portfolio sections" });
  await expect(navigation).toBeVisible();
  for (const label of ["About", "Experience", "Projects", "Blog", "Let's talk"]) {
    await expect(navigation.getByRole("link", { name: label })).toBeVisible();
  }
  expect(await navigation.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true
  );

  const hero = page.locator(".cinematic-hero");
  const mobileProfile = page.locator(".mobile-profile-rail");
  await expect(mobileProfile).toBeVisible();
  await expect(page.locator(".desktop-profile-rail")).toBeHidden();
  const heroBox = await hero.boundingBox();
  const profileBox = await mobileProfile.boundingBox();
  expect(heroBox).not.toBeNull();
  expect(profileBox).not.toBeNull();
  expect(profileBox?.y ?? 0).toBeGreaterThanOrEqual((heroBox?.y ?? 0) + (heroBox?.height ?? 0));
  await expect(mobileProfile.locator(".profile-portrait")).toHaveCSS("min-height", "352px");
  await expect(page.locator(".contact-email")).toHaveCount(0);
});
