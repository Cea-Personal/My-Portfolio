import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public-ai-rate-limit", () => ({ allowPublicAiRequest: () => true }));
vi.mock("@/lib/api/public-data", () => ({
  loadPublicPortfolio: vi.fn(),
  loadPublicBlogPostsWithStatus: vi.fn()
}));
vi.mock("@/lib/server/reasoning-provider", () => ({
  resolveReasoningProviders: vi.fn(),
  generateReasoningJson: vi.fn(),
  anonymizeEmployerReferences: (value: unknown) => value
}));
vi.mock("@/lib/server/embedding-provider", () => ({
  resolveEmbeddingProviders: vi.fn(),
  embedWithFallback: vi.fn(async () => ({ vectors: [] }))
}));
vi.mock("@career-os/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@career-os/observability")>()),
  captureSanitizedError: vi.fn()
}));

import { POST } from "./route";
import { loadPublicPortfolio, loadPublicBlogPostsWithStatus } from "@/lib/api/public-data";
import { generateReasoningJson, resolveReasoningProviders } from "@/lib/server/reasoning-provider";
import { parsePublicChatAnswer } from "@/lib/server/public-chat-answer";

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
  maxTokens: 2000,
  timeoutMs: 120_000,
  retryLimit: 2
};
const metadata = { provider, inputHash: "input", outputHash: "output", elapsedMs: 1 };
const answer =
  "Basil’s software background helps him treat data pipelines as production systems, not isolated scripts. His work on APIs and automated pipeline checks connects how data is delivered with how reliably it can be used.\n\nThat gives him a practical perspective on both the software feeding a platform and the data it produces.";
const question = "How does Basil’s software background help his data engineering work?";
function request(text = question) {
  return new Request("http://localhost/api/v1/public/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: text })
  });
}

describe("Ask Basil conversational synthesis", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    vi.mocked(loadPublicPortfolio).mockResolvedValue({
      source: "live",
      stale: false,
      publication: { owner_id: "owner", content_hash: crypto.randomUUID() },
      items: [
        {
          public_id: "software",
          section: "experience",
          title: "Software Engineer",
          public_summary: "Built production APIs and automated software tests."
        },
        {
          public_id: "data",
          section: "experience",
          title: "Data Engineer",
          public_summary: "Built data pipelines with automated quality checks."
        }
      ],
      evidence: [
        {
          public_evidence_id: "journal",
          evidence_type: "journal",
          sanitized_excerpt: "PRIVATE JOURNAL"
        }
      ]
    });
    vi.mocked(loadPublicBlogPostsWithStatus).mockResolvedValue({
      source: "live",
      posts: [],
      stale: false
    });
    vi.mocked(resolveReasoningProviders).mockResolvedValue([provider]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("allows native synthesis to finish past the old cutoff and returns its connected answer", async () => {
    vi.useFakeTimers();
    vi.mocked(generateReasoningJson).mockImplementation(async (providers, system, input) => {
      expect(providers[0]).toMatchObject({ timeoutMs: 90_000, retryLimit: 0 });
      expect(system).toContain("joining CV fragments");
      expect(input.mode).toBe("retrieved_context");
      expect(JSON.stringify(input)).not.toContain("PRIVATE JOURNAL");
      const context = input.context as { id: string }[];
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      return {
        ...metadata,
        output: { answer, sources: context.map((item) => item.id), status: "answered" }
      };
    });
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(16_000);
    const { data } = await (await pending).json();
    expect(data.answer).toBe(answer);
    expect(data.citations).toHaveLength(2);
    expect(data.citationLabels).toEqual(
      expect.arrayContaining(["Software Engineer", "Data Engineer"])
    );
    expect(data.abstained).toBe(false);
  });

  it("does not substitute or cache raw CV fragments when the agent fails", async () => {
    vi.mocked(generateReasoningJson).mockRejectedValue(new Error("timeout"));
    const first = await (await POST(request())).json();
    const second = await (await POST(request())).json();
    expect(first.data).toMatchObject({ unavailable: true, abstained: true, citations: [] });
    expect(first.data.answer).not.toContain("Built data pipelines");
    expect(second.data.unavailable).toBe(true);
    expect(generateReasoningJson).toHaveBeenCalledTimes(2);
  });

  it("preserves an honest abstention instead of replacing it with unrelated retrieved facts", async () => {
    vi.mocked(generateReasoningJson).mockResolvedValue({
      ...metadata,
      output: {
        answer: "I couldn't find enough information to answer that yet.",
        sources: [],
        status: "abstained"
      }
    });
    const { data } = await (await POST(request())).json();
    expect(data.abstained).toBe(true);
    expect(data.citations).toEqual([]);
    expect(data.answer).toBe("I couldn't find enough information to answer that yet.");
  });

  it("answers ordinary questions without portfolio context", async () => {
    vi.mocked(generateReasoningJson).mockResolvedValue({
      ...metadata,
      output: {
        answer: "A database stores and organises information.",
        sources: [],
        status: "answered"
      }
    });
    const { data } = await (await POST(request("What is a database?"))).json();
    expect(data.answer).toContain("database stores");
    expect(generateReasoningJson).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      { question: "What is a database?", mode: "general" },
      { task: "public_qa" }
    );
  });

  it("rejects unknown citations instead of attaching unrelated retrieved sources", () => {
    expect(() =>
      parsePublicChatAnswer({ answer: "Unsupported claim", sources: ["made-up"] }, [
        { id: "S1", handle: "public-handle" }
      ])
    ).toThrow("PUBLIC_CHAT_UNGROUNDED_ANSWER");
  });
});
