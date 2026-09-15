import { describe, expect, it } from "vitest";
import { flybyApisAdapter } from "./flybyapis";

describe("FlyByAPIs adapter", () => {
  it("uses the shared RapidAPI key and the host from the configured listing", async () => {
    let requestedHeaders: Headers | undefined;
    let requestedMethod: string | undefined;
    let requestedBody: Record<string, unknown> | undefined;
    const records = await flybyApisAdapter.collect({
      endpoint: "https://alternate-jobs-search.p.rapidapi.com/jobs/search",
      headers: { authorization: "Bearer rapid-key" },
      fetcher: async (_input, init) => {
        requestedHeaders = new Headers(init?.headers);
        requestedMethod = init?.method;
        requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ jobs: [{ id: "1", title: "Data Engineer", company: "Acme" }] })
        );
      }
    });

    expect(requestedHeaders?.get("x-rapidapi-key")).toBe("rapid-key");
    expect(requestedHeaders?.get("x-rapidapi-host")).toBe("alternate-jobs-search.p.rapidapi.com");
    expect(requestedHeaders?.get("content-type")).toBe("application/json");
    expect(requestedMethod).toBe("POST");
    expect(requestedBody).toEqual({
      query: "software engineer",
      type: "full-time",
      date_posted: "week",
      page: 1
    });
    expect(records).toEqual([{ externalId: "1", title: "Data Engineer", company: "Acme" }]);
  });
});
