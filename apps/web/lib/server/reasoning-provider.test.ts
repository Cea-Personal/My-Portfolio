import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReasoningJson, type ResolvedReasoningProvider } from "./reasoning-provider";

afterEach(() => vi.unstubAllGlobals());

describe("reasoning provider", () => {
  it("uses the selected model and parses a JSON interview response", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"stagePurpose":"Technical"}' } }] }),
          { status: 200 }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider: ResolvedReasoningProvider = {
      id: "provider-id",
      provider: "openai",
      model: "gpt-test",
      model_version: "1",
      capabilities: ["interview_preparation"],
      secret_ref: "TEST_KEY",
      apiKey: "private-test-key",
      endpoint: "https://api.openai.com/v1/chat/completions",
      creativity: 0.2,
      maxTokens: 2_000,
      timeoutMs: 30_000,
      retryLimit: 0
    };
    const result = await generateReasoningJson([provider], "Return JSON", { job: "Data Engineer" });
    expect(result.output.stagePurpose).toBe("Technical");
    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== "string") throw new Error("Expected JSON request body");
    expect(JSON.parse(request.body)).toMatchObject({
      model: "gpt-test",
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    });
  });
});
