import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS, hybridPublicRetrieval } from "./semantic-retrieval";

describe("hybrid public retrieval", () => {
  it("ranks approved public evidence lexically and excludes private evidence", () => {
    const results = hybridPublicRetrieval("reliable data platform", [
      { id: "direct", content: "Built a reliable data platform.", visibility: "public" },
      { id: "other", content: "Designed frontend interfaces.", visibility: "public" },
      { id: "private", content: "Reliable data platform secret.", visibility: "private" }
    ]);
    expect(results[0]?.id).toBe("direct");
    expect(results.map((item) => item.id)).not.toContain("private");
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });

  it("limits repeated evidence from one source", () => {
    const results = hybridPublicRetrieval(
      "python data",
      [1, 2, 3].map((index) => ({
        id: `same-${index}`,
        content: `Python data pipeline ${index}`,
        visibility: "public" as const,
        metadata: { source: "same-source" }
      }))
    );
    expect(results).toHaveLength(2);
  });
});
