import { describe, expect, it } from "vitest";
import { adzunaAdapter } from "./adzuna";

describe("Adzuna adapter credentials", () => {
  it("sends both application id and API key", async () => {
    let requested: URL | null = null;
    let requestedHeaders: Headers | null = null;
    const records = await adzunaAdapter.collect({
      endpoint: "https://api.adzuna.com/v1/api/jobs/gb/search/1",
      credentials: { applicationId: "application-id" },
      headers: { authorization: "Bearer api-key" },
      fetcher: async (input, init) => {
        requested = new URL(String(input));
        requestedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
    });
    expect(records).toEqual([]);
    expect(requested?.searchParams.get("app_id")).toBe("application-id");
    expect(requested?.searchParams.get("app_key")).toBe("api-key");
    expect(requested?.searchParams.get("page")).toBeNull();
    expect(requested?.searchParams.get("content-type")).toBeNull();
    expect(requestedHeaders?.get("accept")).toBe("application/json");
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

  it("adds the initial page segment when a search collection path is supplied", async () => {
    let requested: URL | null = null;
    await adzunaAdapter.collect({
      endpoint: "https://api.adzuna.com/v1/api/jobs/gb/search",
      credentials: { applicationId: "application-id" },
      headers: { authorization: "Bearer api-key" },
      fetcher: async (input) => {
        requested = new URL(String(input));
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
    });
    expect(requested?.pathname).toBe("/v1/api/jobs/gb/search/1");
  });

  it("upgrades Adzuna's documented HTTP example to HTTPS", async () => {
    let requested: URL | null = null;
    await adzunaAdapter.collect({
      endpoint: "http://api.adzuna.com:80/v1/api/jobs/gb/search/1",
      credentials: { applicationId: "application-id" },
      headers: { authorization: "Bearer api-key" },
      fetcher: async (input) => {
        requested = new URL(String(input));
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
    });
    expect(requested?.protocol).toBe("https:");
    expect(requested?.port).toBe("");
  });
});
