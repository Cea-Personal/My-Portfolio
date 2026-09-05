import { describe, expect, it } from "vitest";
import { remoteOkAdapter } from "./remoteok";

describe("Remote OK adapter", () => {
  it("maps position records, ignores feed metadata, and sends tag filters", async () => {
    let requested = "";
    let requestedHeaders: Headers | undefined;
    const records = await remoteOkAdapter.collect({
      endpoint: "https://remoteok.com/api",
      query: { technology: "python" },
      fetcher: async (input, init) => {
        requested = String(input);
        requestedHeaders = new Headers(init?.headers);
        return new Response(
          JSON.stringify([
            { legal: "credit Remote OK" },
            {
              id: 42,
              slug: "data-engineer-example",
              position: "Data Engineer",
              company: "Example",
              location: "Worldwide",
              url: "https://remoteok.com/remote-jobs/data-engineer-example",
              description: "Build data systems"
            }
          ]),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    expect(requested).toContain("tag=python");
    expect(requestedHeaders?.get("user-agent")).toContain("Mozilla/5.0");
    expect(records).toEqual([
      expect.objectContaining({
        externalId: "data-engineer-example",
        title: "Data Engineer",
        canonicalUrl: "https://remoteok.com/remote-jobs/data-engineer-example"
      })
    ]);
  });

  it("retries the unfiltered feed when a tag-filtered window is empty", async () => {
    const requests: string[] = [];
    const records = await remoteOkAdapter.collect({
      endpoint: "https://remoteok.com/api",
      query: { technology: "data,python" },
      fetcher: async (input) => {
        requests.push(String(input));
        return new Response(
          JSON.stringify(
            requests.length === 1
              ? [{ legal: "credit Remote OK" }]
              : [
                  { legal: "credit Remote OK" },
                  {
                    position: "Data Engineer",
                    company: "Example",
                    url: "https://remoteok.com/remote-jobs/data-engineer"
                  }
                ]
          ),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain("tag=data%2Cpython");
    expect(requests[1]).not.toContain("tag=");
    expect(records).toHaveLength(1);
  });
});
