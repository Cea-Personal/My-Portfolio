import { afterEach, describe, expect, it, vi } from "vitest";
import { rerankWithProvider } from "./reranker-provider";

afterEach(() => vi.unstubAllGlobals());

describe("Cohere reranker provider", () => {
  it("sends the query and candidate documents and preserves relevance scores", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              { index: 1, relevance_score: 0.91 },
              { index: 0, relevance_score: 0.24 }
            ]
          }),
          { status: 200 }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const results = await rerankWithProvider(
      {
        id: "provider",
        provider: "cohere",
        model: "rerank-v3.5",
        model_version: "unversioned",
        capabilities: ["reranker"],
        secret_ref: "COHERE_API_KEY",
        apiKey: "test-key",
        endpoint: "https://api.cohere.com/v2/rerank"
      },
      "data engineering experience",
      ["generic software work", "built an Airflow data platform"]
    );

    expect(results).toEqual([
      { index: 1, score: 0.91 },
      { index: 0, score: 0.24 }
    ]);
    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== "string") throw new Error("Expected JSON request body");
    expect(JSON.parse(request.body)).toMatchObject({
      model: "rerank-v3.5",
      query: "data engineering experience",
      documents: ["generic software work", "built an Airflow data platform"],
      top_n: 2,
      return_documents: false
    });
  });
});
