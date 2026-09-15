import { expect, test } from "@playwright/test";

test("role fit displays the actionable API error and can retry", async ({ page }) => {
  await page.route("**/api/v1/public/jd-matches", async (route) =>
    route.fulfill({
      status: 503,
      json: {
        data: {
          code: "ROLE_FIT_AGENT_UNAVAILABLE",
          detail: "The role analyst could not start. Please check the agent configuration.",
          matches: [],
          unavailable: true
        }
      }
    })
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "How do I fit?" }).click();
  await page.locator("#match > summary").click();
  await page.getByLabel("Role description").fill("Build pipelines with SQL.");
  await page.getByRole("button", { name: "See how I fit" }).click();
  await expect(page.locator("#match").getByRole("alert")).toContainText(
    "The role analyst could not start"
  );
  await expect(page.getByRole("button", { name: "See how I fit" })).toBeEnabled();
  await expect(page.getByLabel("Role description")).toHaveValue("Build pipelines with SQL.");
  await expect(page.locator(".role-fit-results")).toHaveCount(0);
});

test("role fit shows boxed requirements, scores and grounded explanations", async ({ page }) => {
  await page.route("**/api/v1/public/jd-matches", async (route) => {
    await route.fulfill({
      json: {
        data: {
          summary:
            "My experience fits the work you need around keeping data reliable as it moves into production. I’ve built ingestion pipelines and added quality checks, so I can connect how data arrives with whether it is useful downstream.\n\nThat combination is relevant here because the role brings pipeline delivery and data quality together.",
          abstained: false,
          matches: [
            {
              area: "Reliable data delivery",
              score: 100,
              requirements: ["Build pipelines", "Improve data quality"],
              explanation:
                "Basil has built ingestion pipelines and automated quality checks across his data engineering work.",
              sources: [
                { id: "public-role", title: "Data Engineer" },
                { id: "public-project", title: "Quality platform" }
              ]
            },
            {
              area: "Medical license",
              score: 0,
              requirements: ["Medical license required."],
              explanation: "The portfolio does not establish a medical license.",
              sources: []
            }
          ]
        }
      }
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "How do I fit?" }).click();
  await page.locator("#match > summary").click();
  await page
    .getByLabel("Role description")
    .fill("Build pipelines. Improve data quality. Medical license required.");
  await page.getByRole("button", { name: "See how I fit" }).click();
  const results = page.locator(".role-fit-results");
  await expect(results.locator(".role-fit-answer p")).toHaveCount(2);
  await expect(results.locator(".role-fit-answer")).toContainText(
    "My experience fits the work you need"
  );
  await expect(results.getByRole("table")).toHaveCount(1);
  await expect(results.getByRole("columnheader")).toHaveText([
    "Major requirement",
    "Match score",
    "How my experience fits"
  ]);
  await expect(results.getByRole("rowheader", { name: /Reliable data delivery/ })).toBeVisible();
  await expect(results.getByRole("rowheader", { name: /Medical license/ })).toBeVisible();
  await expect(results.locator(".role-fit-score").first()).toHaveText("100/100");
  await expect(results.locator(".role-fit-score").last()).toHaveText("0/100");
  await results.getByText("Supporting experience", { exact: true }).click();
  await expect(results).toContainText("Data Engineer · Quality platform");
  await results.getByText("From the job description", { exact: true }).first().click();
  await expect(results).toContainText("Improve data quality");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-portfolio-theme", "light");
  await expect(results.locator(".role-fit-score").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const table = results.getByRole("table");
  await expect(table).toBeVisible();
  expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true
  );
});

test("Ask Basil shows conversational paragraphs with optional supporting information", async ({
  page
}) => {
  await page.route("**/api/v1/public/chat", (route) =>
    route.fulfill({
      json: {
        data: {
          answer:
            "Basil connects software delivery with reliable data systems.\n\nThat perspective helps him consider both how data arrives and how it is used.",
          citations: ["source"],
          citationLabels: ["Data Engineer"],
          abstained: false
        }
      }
    })
  );
  await page.goto("/");
  await page.getByRole("button", { name: "What data systems has Basil built?" }).click();
  const answer = page.locator(".assistant-answer");
  await expect(answer.locator(":scope > p")).toHaveCount(2);
  await expect(answer.getByRole("list", { name: "Supporting facts" })).not.toBeVisible();
  await answer.getByText("Explore the supporting information").click();
  await expect(answer.getByRole("list", { name: "Supporting facts" })).toContainText(
    "Data Engineer"
  );
});

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
