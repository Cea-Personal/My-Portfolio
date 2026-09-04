import { expect, test, type APIResponse, type Page } from "@playwright/test";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the authenticated browser gate`);
  return value;
}
async function signIn(page: Page) {
  if (process.env.E2E_ALLOW_MUTATIONS !== "true")
    throw new Error("E2E_ALLOW_MUTATIONS=true is required; use an isolated Supabase test project");
  await page.goto("/sign-in?next=/dashboard");
  await page.getByLabel("Email").fill(required("E2E_OWNER_EMAIL"));
  await page.getByLabel("Password").fill(required("E2E_OWNER_PASSWORD"));
  await page.getByRole("button", { name: "Enter private workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function json(response: APIResponse) {
  return (await response.json()) as { data?: Record<string, unknown> };
}

test.describe.serial("configured-owner persisted journeys", () => {
  let jobId = "";
  let applicationId = "";
  let postId = "";
  const factIds: string[] = [];
  const marker = `E2E-${Date.now().toString(36)}`;

  test("Career Brain mutation survives reload", async ({ page }) => {
    await signIn(page);
    const statements = [
      `${marker} verified integration fact`,
      `${marker} delivered a second supported result`
    ];
    for (const [index, statement] of statements.entries()) {
      const response = await page.request.post("/api/v1/career/facts", {
        headers: { "idempotency-key": `fact-${marker}-${String(index).padStart(8, "0")}` },
        data: { statement, factType: "achievement", subjectType: "test", visibility: "private" }
      });
      expect(response.status()).toBe(201);
      const factId = String((await json(response)).data?.id ?? "");
      factIds.push(factId);
      const review = await page.request.patch(`/api/v1/career/facts/${factId}`, {
        headers: {
          "idempotency-key": `fact-review-${marker}-${String(index).padStart(4, "0")}`,
          "if-match": "*"
        },
        data: { visibility: "private", reviewStatus: "approved", verifiedByOwner: true }
      });
      expect(review.ok()).toBe(true);
    }
    await page.goto("/career-brain");
    await page.reload();
    await expect(page.getByText(`${marker} verified integration fact`)).toBeVisible();
  });

  test("job, application, and interview records form a persisted chain", async ({ page }) => {
    await signIn(page);
    const jobResponse = await page.request.post("/api/v1/jobs", {
      headers: { "idempotency-key": `job-${marker}-000000000` },
      data: {
        title: `${marker} Data Engineer`,
        company: "Fixture Company",
        description: "Build SQL and Python data platforms."
      }
    });
    expect(jobResponse.status()).toBe(201);
    const jobPayload = await json(jobResponse);
    jobId = String((jobPayload.data?.job as Record<string, unknown> | undefined)?.id ?? "");
    const transition = await page.request.post(`/api/v1/jobs/${jobId}/transitions`, {
      headers: { "idempotency-key": `transition-${marker}-0000` },
      data: { status: "interested", reason: "isolated acceptance fixture" }
    });
    expect(transition.ok()).toBe(true);
    const application = await page.request.post(`/api/v1/jobs/${jobId}/applications`, {
      headers: { "idempotency-key": `application-${marker}-00` },
      data: {}
    });
    expect(application.status()).toBe(201);
    applicationId = String((await json(application)).data?.id);
    const interview = await page.request.post(
      `/api/v1/applications/${applicationId}/interview-process`,
      { headers: { "idempotency-key": `interview-${marker}-00000` }, data: { confidence: "low" } }
    );
    expect(interview.status()).toBe(201);
    const resume = await page.request.post(`/api/v1/applications/${applicationId}/compose`, {
      headers: { "idempotency-key": `resume-${marker}-0000000` },
      data: {
        artifactType: "resume",
        title: `${marker} CV`,
        content: "Evidence-backed integration CV.",
        evidenceIds: [factIds[0]]
      }
    });
    expect(resume.status()).toBe(201);
    const coverLetter = await page.request.post(`/api/v1/applications/${applicationId}/compose`, {
      headers: { "idempotency-key": `letter-${marker}-0000000` },
      data: {
        artifactType: "cover_letter",
        title: `${marker} cover letter`,
        content: "Evidence-backed integration letter.",
        evidenceIds: factIds
      }
    });
    expect(coverLetter.status()).toBe(201);
    await page.goto("/interviews");
    await page.reload();
    await expect(page.getByText(`${marker} Data Engineer`)).toBeVisible();
  });

  test("journal, Blog, analytics, automation, and export endpoints persist outcomes", async ({
    page
  }) => {
    await signIn(page);
    const journal = await page.request.post("/api/v1/journal-entries", {
      headers: { "idempotency-key": `journal-${marker}-000000` },
      data: {
        title: marker,
        text: "A private test reflection.",
        entryDate: new Date().toISOString().slice(0, 10),
        tags: ["e2e"]
      }
    });
    expect(journal.status()).toBe(201);
    const post = await page.request.post("/api/v1/posts", {
      headers: { "idempotency-key": `post-${marker}-000000000` },
      data: {
        title: marker,
        slug: marker.toLowerCase(),
        excerpt: "Fixture excerpt",
        markdown: "# Fixture\n\nTechnical content only.",
        tags: ["test"]
      }
    });
    expect(post.status()).toBe(201);
    postId = String(
      ((await json(post)).data?.post as Record<string, unknown> | undefined)?.id ?? ""
    );
    const publish = await page.request.post(`/api/v1/posts/${postId}/publish`, {
      headers: { "idempotency-key": `publish-${marker}-000000` },
      data: { confirmation: true }
    });
    expect(publish.ok()).toBe(true);
    expect((await page.request.get(`/api/v1/public/posts/${marker.toLowerCase()}`)).ok()).toBe(
      true
    );
    const automation = await page.request.post("/api/v1/automations", {
      headers: { "idempotency-key": `schedule-${marker}-000000` },
      data: { purpose: "analytics_aggregate", recurrence: "weekly", timezone: "Africa/Kigali" }
    });
    expect(automation.status()).toBe(201);
    const exportResponse = await page.request.post("/api/v1/exports", {
      headers: { "idempotency-key": `export-${marker}-00000000` },
      data: { format: "json" }
    });
    expect(exportResponse.status()).toBe(202);
    expect((await page.request.get("/api/v1/analytics/applications")).ok()).toBe(true);
    for (const route of ["/journal", "/blogs", "/automations", "/settings/data"]) {
      await page.goto(route);
      await page.reload();
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("private document upload and public projection commands persist", async ({ page }) => {
    await signIn(page);
    await page.goto("/documents");
    await page.getByLabel("Upload a private source").setInputFiles({
      name: `${marker}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("isolated evidence fixture")
    });
    await page.getByRole("button", { name: "Upload source" }).click();
    await expect(page.getByText(marker, { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.getByText(marker, { exact: false })).toBeVisible();
    const drive = await page.request.get("/api/v1/integrations/drive/authorize");
    expect(drive.status()).toBe(200);
    const authorizationUrl = String((await json(drive)).data?.authorizationUrl ?? "");
    expect(authorizationUrl).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    expect(authorizationUrl).not.toContain(required("GOOGLE_DRIVE_CLIENT_SECRET"));
    const staged = await page.request.post("/api/v1/portfolio/publications", {
      headers: { "idempotency-key": `projection-${marker}-stage` },
      data: { action: "stage", confirmation: true }
    });
    expect(staged.status()).toBe(201);
    const publicationId = String((await json(staged)).data?.publicationId ?? "");
    const activated = await page.request.post("/api/v1/portfolio/publications", {
      headers: { "idempotency-key": `projection-${marker}-activate` },
      data: { action: "activate", confirmation: true, publicationId }
    });
    expect(activated.status()).toBe(201);
    expect((await page.request.get("/api/v1/public/portfolio")).ok()).toBe(true);
  });
});

test("authenticated non-owner is denied every private surface", async ({ page }) => {
  if (process.env.E2E_ALLOW_MUTATIONS !== "true")
    throw new Error("E2E_ALLOW_MUTATIONS=true is required");
  await page.goto("/sign-in?next=/analytics");
  await page.getByLabel("Email").fill(required("E2E_NON_OWNER_EMAIL"));
  await page.getByLabel("Password").fill(required("E2E_NON_OWNER_PASSWORD"));
  await page.getByRole("button", { name: "Enter private workspace" }).click();
  await expect(page).toHaveURL(/\/sign-in\?error=not_authorized/);
  expect((await page.request.get("/api/v1/career/facts")).status()).toBe(401);
});
