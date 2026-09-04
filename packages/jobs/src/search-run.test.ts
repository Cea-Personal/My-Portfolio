import { describe, expect, it } from "vitest";
import { runSearch } from "./search-run";

describe("durable search normalization", () => {
  it("applies source field mappings and preserves partial failures", async () => {
    const result = await runSearch(
      [
        {
          id: "mapped",
          input: { fieldMapping: { employer: "company", role: "title" } },
          adapter: {
            type: "fixture",
            version: "v1",
            capabilities: ["collect"],
            collect: async () => [{ employer: "Example", role: "Engineer" }]
          }
        },
        {
          id: "failed",
          input: {},
          adapter: {
            type: "failing",
            version: "v1",
            capabilities: ["collect"],
            collect: async () => {
              throw new Error("upstream unavailable");
            }
          }
        }
      ],
      "search-run-00000001",
      new Set(),
      { maxAttempts: 1, retryDelayMs: 0 }
    );
    expect(result.status).toBe("partial");
    expect(result.jobs).toEqual([
      expect.objectContaining({ company: "Example", title: "Engineer" })
    ]);
    expect(result.sources.find((source) => source.sourceId === "failed")?.error).toBe(
      "upstream unavailable"
    );
  });

  it("retries a transient source without losing its attempt history", async () => {
    let calls = 0;
    const result = await runSearch(
      [
        {
          id: "transient",
          input: {},
          adapter: {
            type: "fixture",
            version: "v1",
            capabilities: ["collect"],
            collect: async () => {
              calls += 1;
              if (calls < 2) throw new Error("SOURCE_HTTP_503");
              return [{ company: "Example", title: "Data Engineer" }];
            }
          }
        }
      ],
      "search-run-00000002",
      new Set(),
      { maxAttempts: 3, retryDelayMs: 0 }
    );
    expect(result.status).toBe("completed");
    expect(result.sources[0]).toMatchObject({ attempts: 2, fetchedCount: 1, rejectedCount: 0 });
  });
});
