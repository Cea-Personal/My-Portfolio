import { expect, test } from "@playwright/test";

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
  await expect(page.getByRole("tab", { name: "How do I fit?" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "What data systems has Basil built?" })
  ).toBeVisible();
  await expect(page.getByPlaceholder("Ask something about Basil…")).toBeVisible();
  await expect(page.locator("#about")).toHaveAttribute("data-reveal", /visible|pending/);
  await page.getByRole("button", { name: "What data systems has Basil built?" }).click();
  await expect(page.locator(".assistant-user-message")).toContainText("What data systems");
});
