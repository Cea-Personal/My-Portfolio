import { describe, expect, it } from "vitest";
import { linkedinAuthorizedAdapter } from "./linkedin-authorized";

describe("authorized LinkedIn feed adapter", () => {
  it("normalizes a provider payload without contacting linkedin.com", async () => {
    const records = await linkedinAuthorizedAdapter.collect({
      endpoint: "https://licensed-provider.example/jobs",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "job-1",
                companyName: "Example",
                title: "Data Engineer",
                url: "https://www.linkedin.com/jobs/view/job-1",
                descriptionText: "Build data systems"
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        )
    });
    expect(records).toEqual([
      expect.objectContaining({
        externalId: "job-1",
        company: "Example",
        title: "Data Engineer"
      })
    ]);
  });
});
