import { describe, expect, it } from "vitest";
import artifact from "@/public/generated/public-fallback.json";
import { parsePublicFallbackArtifact, readPublicFallbackArtifact } from "./public-fallback";
import { resolvePublicPortfolioRead } from "./public-data";

describe("public fallback artifact", () => {
  it("accepts the generated allowlisted snapshot", () => {
    const parsed = readPublicFallbackArtifact();
    expect(parsed?.schema_version).toBe("portfolio-fallback.v1");
    expect(parsed?.publication?.status).toBe("published");
    expect(parsed?.items.some((item) => item.title === "Portfolio as Proof")).toBe(true);
    expect(parsed?.items.some((item) => item.title === "Engineering processes")).toBe(false);
    expect(parsed?.blog[0]?.supports_employment_claim).toBe(false);
  });

  it("fails closed for withdrawn or malformed snapshots", () => {
    expect(
      parsePublicFallbackArtifact({
        ...artifact,
        publication: { ...artifact.publication, status: "withdrawn" }
      })
    ).toBeNull();
    expect(parsePublicFallbackArtifact({ ...artifact, source_publication_version: 0 })).toBeNull();
    expect(
      parsePublicFallbackArtifact({ ...artifact, items: [{ title: "untrusted" }] })
    ).toBeNull();
  });

  it("gives an explicit empty publication precedence over fallback data", () => {
    const outcome = resolvePublicPortfolioRead({ publication: null, items: [], evidence: [] });
    expect(outcome.source).toBe("empty");
    expect(outcome.items).toEqual([]);
  });
});
