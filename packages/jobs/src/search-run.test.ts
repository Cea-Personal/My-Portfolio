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
      "search-run-00000001"
    );
    expect(result.status).toBe("partial");
    expect(result.jobs).toEqual([
      expect.objectContaining({ company: "Example", title: "Engineer" })
    ]);
    expect(result.sources.find((source) => source.sourceId === "failed")?.error).toBe(
      "upstream unavailable"
    );
  });
});
