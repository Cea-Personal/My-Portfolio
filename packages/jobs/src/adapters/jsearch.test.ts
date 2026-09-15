import { describe, expect, it } from "vitest";
import { jsearchAdapter } from "./jsearch";

describe("JSearch adapter gateways", () => {
  it("calls OpenWeb Ninja with x-api-key and unwraps its data.jobs response", async () => {
    let requested: URL | null = null;
    let headers: Headers | null = null;
    const records = await jsearchAdapter.collect({
      endpoint: "https://api.openwebninja.com/jsearch/search-v2",
      headers: { authorization: "Bearer openweb-key" },
      query: { title: "data engineer", location: "United Kingdom" },
      fetcher: async (input, init) => {
        requested = new URL(String(input));
        headers = new Headers(init?.headers);
        return new Response(
          JSON.stringify({
            status: "OK",
            data: { jobs: [{ job_id: "job-1", job_title: "Data Engineer", employer_name: "Acme" }] }
          }),
          { status: 200 }
        );
      }
    });

    expect(headers?.get("x-api-key")).toBe("openweb-key");
    expect(headers?.get("x-rapidapi-key")).toBeNull();
    expect(requested?.pathname).toBe("/jsearch/search-v2");
    expect(requested?.searchParams.get("query")).toContain("data engineer");
    expect(records).toEqual([{ externalId: "job-1", title: "Data Engineer", company: "Acme" }]);
  });

  it("keeps RapidAPI authentication for an explicitly configured RapidAPI endpoint", async () => {
    let headers: Headers | null = null;
    await jsearchAdapter.collect({
      endpoint: "https://jsearch.p.rapidapi.com/search",
      headers: { authorization: "Bearer rapidapi-key" },
      fetcher: async (_input, init) => {
        headers = new Headers(init?.headers);
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
    });
    expect(headers?.get("x-rapidapi-key")).toBe("rapidapi-key");
    expect(headers?.get("x-rapidapi-host")).toBe("jsearch.p.rapidapi.com");
    expect(headers?.get("x-api-key")).toBeNull();
  });

  it("keeps a configured RapidAPI endpoint even when the legacy source ref is JSEARCH_API_KEY", async () => {
    let requested: URL | null = null;
    await jsearchAdapter.collect({
      endpoint: "https://jsearch.p.rapidapi.com/search",
      credentials: { secretRef: "JSEARCH_API_KEY" },
      headers: { authorization: "Bearer openweb-key" },
      fetcher: async (input) => {
        requested = new URL(String(input));
        return new Response(JSON.stringify({ data: { jobs: [] } }), { status: 200 });
      }
    });
    expect(requested?.hostname).toBe("jsearch.p.rapidapi.com");
    expect(requested?.pathname).toBe("/search");
  });

  it("explains that an OpenWeb Ninja plan is required for 401/403 responses", async () => {
    for (const status of [401, 403]) {
      await expect(
        jsearchAdapter.collect({
          endpoint: "https://api.openwebninja.com/jsearch/search-v2",
          headers: { authorization: "Bearer openweb-key" },
          fetcher: async () => new Response("not subscribed", { status })
        })
      ).rejects.toThrow("JSEARCH_OPENWEBNINJA_UNAUTHORIZED: subscribe to JSearch");
    }
  });
});
