import { afterEach, describe, expect, it, vi } from "vitest";
import { embedWithProvider, PRODUCTION_EMBEDDING_DIMENSIONS } from "./embedding-provider";

afterEach(() => vi.unstubAllGlobals());

describe("production embedding provider", () => {
  it("uses the configured model and validates 1536 dimensions", async () => {
    const embedding = Array.from({ length: PRODUCTION_EMBEDDING_DIMENSIONS }, () => 0.01);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ data: [{ index: 0, embedding }] }), { status: 200 })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const vectors = await embedWithProvider(
      {
        id: "provider",
        provider: "openai",
        model: "text-embedding-3-small",
        model_version: "1",
        capabilities: ["embeddings"],
        secret_ref: "OPENAI_API_KEY",
        apiKey: "test-key",
        endpoint: "https://api.openai.com/v1/embeddings"
      },
      ["career evidence"]
    );
    expect(vectors[0]).toHaveLength(PRODUCTION_EMBEDDING_DIMENSIONS);
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    if (typeof request?.body !== "string") throw new Error("Expected JSON request body");
    expect(JSON.parse(request.body)).toMatchObject({
      model: "text-embedding-3-small",
      dimensions: 1536
    });
  });
});
