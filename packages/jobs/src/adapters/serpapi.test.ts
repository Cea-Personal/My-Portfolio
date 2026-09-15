import { describe, expect, it } from "vitest";
import { serpApiAdapter } from "./serpapi";

describe("SerpApi adapter", () => {
  it("does not send Remote as a geographic location", async () => {
    let requested: URL | undefined;
    await serpApiAdapter.collect({
      headers: { authorization: "Bearer serp-test" },
      query: { title: "Data Engineer", location: "Remote" },
      fetcher: async (input) => {
        requested = new URL(String(input));
        return new Response(JSON.stringify({ jobs_results: [] }));
      }
    });
    expect(requested?.searchParams.get("location")).toBeNull();
    expect(requested?.searchParams.get("q")).toContain("Remote");
  });
});
