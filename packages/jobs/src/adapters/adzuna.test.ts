import { describe, expect, it } from "vitest";
import { adzunaAdapter } from "./adzuna";

describe("Adzuna adapter credentials", () => {
  it("sends both application id and API key", async () => {
    let requested: URL | null = null;
    const records = await adzunaAdapter.collect({
      endpoint: "https://api.adzuna.com/v1/api/jobs/gb/search/1",
      credentials: { applicationId: "application-id" },
      headers: { authorization: "Bearer api-key" },
      fetcher: async (input) => {
        requested = new URL(String(input));
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
    });
    expect(records).toEqual([]);
    expect(requested?.searchParams.get("app_id")).toBe("application-id");
    expect(requested?.searchParams.get("app_key")).toBe("api-key");
  });

  it("fails clearly when either credential is missing", async () => {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    try {
      await expect(
        adzunaAdapter.collect({
          endpoint: "https://api.adzuna.com/v1/api/jobs/gb/search/1",
          credentials: { applicationId: "application-id" }
        })
      ).rejects.toThrow("SOURCE_CREDENTIALS_MISSING:ADZUNA_APP_ID/ADZUNA_APP_KEY");
    } finally {
      if (appId === undefined) delete process.env.ADZUNA_APP_ID;
      else process.env.ADZUNA_APP_ID = appId;
      if (appKey === undefined) delete process.env.ADZUNA_APP_KEY;
      else process.env.ADZUNA_APP_KEY = appKey;
    }
  });
});
