import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public-ai-rate-limit", () => ({ allowPublicAiRequest: () => true }));
vi.mock("@/lib/api/public-data", () => ({ loadPublicPortfolio: vi.fn() }));
vi.mock("@/lib/server/reasoning-provider", () => ({
  resolveReasoningProviders: vi.fn(),
  generateReasoningJson: vi.fn(),
  anonymizeEmployerReferences: (value: unknown) => value
}));

import { POST } from "./route";
import { loadPublicPortfolio } from "@/lib/api/public-data";
import { generateReasoningJson, resolveReasoningProviders } from "@/lib/server/reasoning-provider";

const description =
  "Build reliable data pipelines. Improve data quality. Must hold a medical license.";
const provider = {
  id: "provider",
  provider: "codex_app_server",
  model: "server-default",
  model_version: "",
  capabilities: ["reasoning"],
  secret_ref: null,
  apiKey: "",
  endpoint: "codex://local",
  creativity: 0,
  maxTokens: 4000,
  timeoutMs: 90_000,
  retryLimit: 0
};
const generationMetadata = { provider, inputHash: "input", outputHash: "output", elapsedMs: 10 };
const snapshot = {
  source: "live" as const,
  stale: false,
  publication: { id: "publication", owner_id: "owner", content_hash: "v1" },
  items: [
    {
      public_id: "role",
      section: "experience",
      title: "Data Engineer",
      public_summary: "Built reliable data ingestion pipelines in Python."
    },
    {
      public_id: "project",
      section: "projects",
      title: "Quality platform",
      public_summary: "Added automated data quality checks and alerts."
    }
  ],
  evidence: [
    {
      public_evidence_id: "private-note",
      evidence_type: "journal",
      sanitized_excerpt: "Private diary text."
    }
  ]
};

function request() {
  return new Request("http://localhost/api/v1/public/jd-matches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description })
  });
}

describe("public role comparison", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.mocked(loadPublicPortfolio).mockResolvedValue(snapshot);
    vi.mocked(resolveReasoningProviders).mockResolvedValue([provider]);
  });

  it("invokes role_fit and aggregates multiple requirements and public sources into one match", async () => {
    vi.mocked(generateReasoningJson).mockImplementation(async (_providers, _system, input) => {
      const context = input.context as { id: string; text: string }[];
      expect(context).toHaveLength(2);
      expect(JSON.stringify(context)).not.toContain("Private diary");
      return {
        ...generationMetadata,
        output: {
          summary: "The role focuses on reliable pipelines and data quality.",
          matches: [
            {
              area: "Reliable data delivery",
              score: 100,
              requirements: ["Build reliable data pipelines.", "Improve data quality."],
              explanation:
                "Basil has built Python ingestion pipelines and automated quality checks, covering both delivery and reliability.",
              sources: context.map((item) => item.id)
            }
          ]
        }
      };
    });
    const response = await POST(request());
    const { data } = await response.json();
    expect(response.status).toBe(200);
    expect(generateReasoningJson).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      expect.objectContaining({ description, audience: "public" }),
      { task: "role_fit" }
    );
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].score).toBe(100);
    expect(data.matches[0].sources.map((source: { title: string }) => source.title)).toEqual([
      "Data Engineer",
      "Quality platform"
    ]);
    expect(data).not.toHaveProperty("score");
    expect(data).not.toHaveProperty("requirements");
    expect(JSON.stringify(data)).not.toContain("medical license");
  });

  it("returns no matches without substituting generic or keyword-only recommendations", async () => {
    vi.mocked(generateReasoningJson).mockResolvedValue({
      ...generationMetadata,
      output: { summary: "Medical role", matches: [] }
    });
    const { data } = await (await POST(request())).json();
    expect(data.abstained).toBe(true);
    expect(data.matches).toEqual([]);
    expect(data.summary).toContain("couldn’t find enough information");
  });

  it("reports provider failures as unavailable, not as a completed comparison", async () => {
    vi.mocked(generateReasoningJson).mockRejectedValue(new Error("timeout"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).data).toMatchObject({ unavailable: true, matches: [] });
  });

  it("does not run the analyst against a fallback snapshot", async () => {
    vi.mocked(loadPublicPortfolio).mockResolvedValue({ ...snapshot, source: "fallback" });
    const { data } = await (await POST(request())).json();
    expect(data.unavailable).toBe(true);
    expect(generateReasoningJson).not.toHaveBeenCalled();
  });
});
