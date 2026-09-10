import { afterEach, describe, expect, it, vi } from "vitest";
import {
  anonymizeEmployerReferences,
  generateReasoningJson,
  type ResolvedReasoningProvider
} from "./reasoning-provider";

const runCodexOrchestratorMock = vi.hoisted(() => vi.fn());
vi.mock("./codex-app-server", () => ({ runCodexOrchestrator: runCodexOrchestratorMock }));

afterEach(() => {
  vi.unstubAllGlobals();
  runCodexOrchestratorMock.mockReset();
});

describe("reasoning provider", () => {
  it("anonymizes restricted employer references in nested model output", () => {
    expect(
      anonymizeEmployerReferences({
        summary: "Built a platform at Thames Water PLC",
        bullets: ["thames-water migration"]
      })
    ).toEqual({
      summary: "Built a platform at a utilities organisation",
      bullets: ["a utilities organisation migration"]
    });
  });

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

  it("delegates native Codex App Server reasoning to the selected native agent", async () => {
    runCodexOrchestratorMock.mockResolvedValue({
      text: "{}",
      model: "gpt-test",
      threadId: "thread-test"
    });
    const provider: ResolvedReasoningProvider = {
      id: "codex-provider",
      provider: "codex_app_server",
      model: "server-default",
      model_version: "unversioned",
      capabilities: ["reasoning"],
      secret_ref: null,
      apiKey: "",
      endpoint: "codex://local",
      creativity: 0.2,
      maxTokens: 2_000,
      timeoutMs: 30_000,
      retryLimit: 0
    };
    await generateReasoningJson(
      [provider],
      "Return JSON",
      { question: "test" },
      { task: "document_composition" }
    );
    expect(runCodexOrchestratorMock).toHaveBeenCalledWith(
      "document_composition",
      { system: "Return JSON", input: { question: "test" } },
      { timeoutMs: 30_000 }
    );
  });

  it("moves to a fallback instead of retrying a timed-out native request", async () => {
    runCodexOrchestratorMock.mockRejectedValueOnce(
      new Error("CODEX_APP_SERVER_REQUEST_FAILED:timeout")
    );
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":"yes"}' } }] }), {
          status: 200
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const nativeProvider: ResolvedReasoningProvider = {
      id: "codex-provider",
      provider: "codex_app_server",
      model: "server-default",
      model_version: "unversioned",
      capabilities: ["reasoning"],
      secret_ref: null,
      apiKey: "",
      endpoint: "codex://local",
      creativity: 0.2,
      maxTokens: 2_000,
      timeoutMs: 120_000,
      retryLimit: 2
    };
    const fallbackProvider: ResolvedReasoningProvider = {
      id: "openai-provider",
      provider: "openai",
      model: "gpt-test",
      model_version: "1",
      capabilities: ["reasoning"],
      secret_ref: "TEST_KEY",
      apiKey: "private-test-key",
      endpoint: "https://api.openai.com/v1/chat/completions",
      creativity: 0.2,
      maxTokens: 2_000,
      timeoutMs: 30_000,
      retryLimit: 0
    };
    const result = await generateReasoningJson([nativeProvider, fallbackProvider], "Return JSON", {
      question: "test"
    });
    expect(result.provider.provider).toBe("openai");
    expect(runCodexOrchestratorMock).toHaveBeenCalledTimes(1);
  });

  it("uses the last complete object when a native stream includes multiple JSON messages", async () => {
    runCodexOrchestratorMock.mockResolvedValue({
      text: '{"status":"child"}{"status":"orchestrator"}',
      model: "gpt-test",
      threadId: "thread-test"
    });
    const provider: ResolvedReasoningProvider = {
      id: "codex-provider",
      provider: "codex_app_server",
      model: "server-default",
      model_version: "unversioned",
      capabilities: ["reasoning"],
      secret_ref: null,
      apiKey: "",
      endpoint: "codex://local",
      creativity: 0.2,
      maxTokens: 2_000,
      timeoutMs: 30_000,
      retryLimit: 0
    };
    const result = await generateReasoningJson(
      [provider],
      "Return JSON",
      { healthCheck: true },
      { task: "writing_assistance" }
    );
    expect(result.output).toEqual({ status: "orchestrator" });
  });
});
