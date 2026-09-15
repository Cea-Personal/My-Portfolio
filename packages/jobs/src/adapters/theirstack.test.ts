import { describe, expect, it } from "vitest";
import { theirStackAdapter } from "./theirstack";

describe("TheirStack adapter", () => {
  it("resolves profile locations to catalog IDs and handles remote separately", async () => {
    const requests: URL[] = [];
    let searchBody: Record<string, unknown> | undefined;
    await theirStackAdapter.collect({
      query: { title: "Data Engineer", location: "United Kingdom,Remote" },
      headers: { authorization: "Bearer theirstack-test" },
      fetcher: async (input, init) => {
        const url = new URL(String(input));
        requests.push(url);
        if (url.pathname.endsWith("/catalog/locations")) {
          return new Response(JSON.stringify([{ id: 999, name: "United Kingdom" }]));
        }
        searchBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ data: [] }));
      }
    });
    expect(requests.some((url) => url.pathname.endsWith("/catalog/locations"))).toBe(true);
    expect(searchBody?.job_location_or).toEqual([{ id: 999 }]);
    expect(searchBody?.remote).toBe(true);
    expect(searchBody?.job_location_pattern_or).toBeUndefined();
  });

  it("keeps an unresolved location as a deprecated pattern fallback", async () => {
    let searchBody: Record<string, unknown> | undefined;
    await theirStackAdapter.collect({
      query: { location: "Somewhere" },
      headers: { authorization: "Bearer theirstack-test" },
      fetcher: async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/catalog/locations")) return new Response(JSON.stringify([]));
        searchBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ data: [] }));
      }
    });
    expect(searchBody?.job_location_pattern_or).toEqual(["Somewhere"]);
    expect(searchBody?.job_location_or).toBeUndefined();
  });
});
