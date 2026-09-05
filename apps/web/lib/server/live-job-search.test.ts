import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLiveJobs } from "./live-job-search";
import type { ResolvedReasoningProvider } from "./reasoning-provider";

const provider: ResolvedReasoningProvider = {
  id: "provider",
  provider: "openai",
  model: "gpt-test",
  model_version: "1",
  capabilities: ["reasoning"],
  secret_ref: "TEST_KEY",
  apiKey: "test-key",
  endpoint: "https://api.openai.com/v1/chat/completions",
  creativity: 0.2,
  maxTokens: 4000,
  timeoutMs: 30_000,
  retryLimit: 0
};

afterEach(() => vi.restoreAllMocks());

describe("live web job search", () => {
  it("uses an allowlisted web-search tool and validates returned URLs", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const result = await searchLiveJobs(
      provider,
      {
        targetTitles: ["Data Engineer"],
        preferredTitles: [],
        locations: ["Remote"],
        requiredTechnologies: [],
        preferredTechnologies: [],
        workArrangements: [],
        employmentTypes: []
      },
      {
        allowedDomains: ["example.com"],
        fetcher: (_input, init) => {
          requestBody = JSON.parse(init?.body as string) as Record<string, unknown>;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                output_text: JSON.stringify({
                  jobs: [
                    {
                      title: "Data Engineer",
                      company: "Example",
                      canonicalUrl: "https://example.com/jobs/1"
                    },
                    {
                      title: "Spoofed",
                      company: "Bad",
                      canonicalUrl: "https://evil.example/jobs/2"
                    }
                  ]
                })
              }),
              { status: 200 }
            )
          );
        }
      }
    );
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.company).toBe("Example");
    expect(requestBody?.model).toBe("gpt-test");
    expect(requestBody?.tools).toEqual([
      { type: "web_search", filters: { allowed_domains: ["example.com"] } }
    ]);
  });
});
