import { describe, expect, it, vi } from "vitest";
import { jobsPipeAdapter } from "./jobspipe";

describe("JobsPipe MCP adapter", () => {
  it("calls the search_jobs MCP tool with search-profile filters", async () => {
    const mcpToolCaller = vi.fn(async () => ({
      structuredContent: {
        metadata: { total_results: 1 },
        data: [
          {
            id: "jp-1",
            title: "Senior Data Engineer",
            company: "Example",
            location: "Remote",
            url: "https://example.com/jobs/jp-1"
          }
        ]
      }
    }));

    const records = await jobsPipeAdapter.collect({
      endpoint: "https://mcp.jobspipe.dev/mcp",
      headers: { authorization: "Bearer jp_live_test" },
      query: {
        title: "Senior Data Engineer",
        location: "United Kingdom",
        technology: "Airflow,dbt",
        workArrangement: "Remote",
        maxJobAgeDays: 7
      },
      mcpToolCaller
    });

    expect(mcpToolCaller).toHaveBeenCalledWith({
      endpoint: "https://mcp.jobspipe.dev/mcp",
      bearerToken: "jp_live_test",
      tool: "search_jobs",
      arguments: {
        job_title_or: ["Senior Data Engineer"],
        job_location_or: ["United Kingdom"],
        skills_or: ["airflow", "dbt"],
        remote: true,
        posted_at_max_age_days: 7,
        limit: 10,
        include_total_results: false
      }
    });
    expect(records).toEqual([
      {
        externalId: "jp-1",
        title: "Senior Data Engineer",
        company: "Example",
        location: "Remote",
        canonicalUrl: "https://example.com/jobs/jp-1"
      }
    ]);
  });

  it("accepts JSON returned in MCP text content", async () => {
    const records = await jobsPipeAdapter.collect({
      headers: { authorization: "Bearer jp_live_test" },
      mcpToolCaller: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              data: [{ id: "jp-2", title: "AI Engineer", company: "Example" }]
            })
          }
        ]
      })
    });

    expect(records).toEqual([{ externalId: "jp-2", title: "AI Engineer", company: "Example" }]);
  });

  it("upgrades a previously saved REST endpoint to the hosted MCP endpoint", async () => {
    const mcpToolCaller = vi.fn(async () => ({ structuredContent: { data: [] } }));

    await jobsPipeAdapter.collect({
      endpoint: "https://api.jobspipe.dev/v1/jobs/search",
      headers: { authorization: "Bearer jp_live_test" },
      mcpToolCaller
    });

    expect(mcpToolCaller).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://mcp.jobspipe.dev/mcp", tool: "search_jobs" })
    );
  });
});
