import { describe, expect, it } from "vitest";
import { parsePublicRoleFit, publicRoleFitFailure, publicRoleFitRequest } from "./public-role-fit";

const context = [
  { id: "published-pipeline", title: "Data Engineer", text: "Built Python pipelines." }
];
const valid = {
  area: "Data pipelines",
  score: 100,
  requirements: ["Build pipelines"],
  explanation: "Basil built Python pipelines.",
  sources: ["published-pipeline"]
};

describe("grounded role-fit output", () => {
  it("keeps unsupported requirements visible without claiming a lack of experience", () => {
    const result = parsePublicRoleFit(
      {
        summary: "Pipelines align; medical credentials are unconfirmed.",
        matches: [
          valid,
          {
            area: "Medical credentials",
            requirements: ["Medical license"],
            score: 0,
            explanation: "The portfolio does not establish a medical license.",
            sources: []
          }
        ]
      },
      "Build pipelines. Medical license",
      context
    );
    expect(result.matches.map((match) => match.score)).toEqual([100, 0]);
    expect(result.matches[1]?.sources).toEqual([]);
  });

  it("rejects positive scores without sources and scores outside the rubric", () => {
    expect(() =>
      parsePublicRoleFit(
        { summary: "Fit", matches: [{ ...valid, sources: [] }] },
        "Build pipelines",
        context
      )
    ).toThrow("ROLE_FIT_UNGROUNDED_OUTPUT");
    expect(() =>
      parsePublicRoleFit(
        { summary: "Fit", matches: [{ ...valid, score: 99 }] },
        "Build pipelines",
        context
      )
    ).toThrow();
  });

  it("does not truncate a comparison with more than eight major requirements", () => {
    const matches = Array.from({ length: 12 }, (_, index) => ({
      ...valid,
      area: `Requirement ${index}`,
      requirements: [`Requirement ${index}`],
      score: 0,
      sources: []
    }));
    expect(
      parsePublicRoleFit(
        { summary: "Not established", matches },
        matches.map((row) => row.area).join(". "),
        context
      ).matches
    ).toHaveLength(12);
  });
  it("resolves compact analyst citations back to original requirements and public handles", () => {
    const sources = [{ ...context[0]!, reference: "S1" }];
    const description = "Build pipelines. Improve quality.";
    const input = publicRoleFitRequest(description, sources);
    expect(input.context[0]?.id).toBe("S1");
    expect(input.jobRequirements).toEqual([
      { id: "J1", text: "Build pipelines." },
      { id: "J2", text: "Improve quality." }
    ]);
    const result = parsePublicRoleFit(
      {
        summary: "Data engineering",
        matches: [{ ...valid, requirements: ["J1", "J2"], sources: ["S1"] }]
      },
      description,
      sources
    );
    expect(result.matches[0]?.requirements).toEqual(["Build pipelines.", "Improve quality."]);
    expect(result.matches[0]?.sources).toEqual([
      { id: "published-pipeline", title: "Data Engineer" }
    ]);
    expect(() =>
      parsePublicRoleFit(
        {
          summary: "Data engineering",
          matches: [{ ...valid, requirements: ["J999"], sources: ["S1"] }]
        },
        description,
        sources
      )
    ).toThrow("ROLE_FIT_UNGROUNDED_OUTPUT");
  });
  it("distinguishes execution failures from no matching experience without leaking diagnostics", () => {
    expect(
      publicRoleFitFailure(
        new Error(
          "CODEX_APP_SERVER_REQUEST_FAILED:native child agent did not start:role-fit-analyst"
        )
      )
    ).toMatchObject({ code: "ROLE_FIT_AGENT_UNAVAILABLE" });
    expect(
      publicRoleFitFailure(new Error("CODEX_APP_SERVER_REQUEST_FAILED:timeout"))
    ).toMatchObject({ code: "ROLE_FIT_TIMEOUT" });
    const failure = publicRoleFitFailure(new Error("AI_PROVIDER_SECRET_MISSING:PRIVATE_ENV_KEY"));
    expect(failure.code).toBe("ROLE_FIT_CONFIGURATION_UNAVAILABLE");
    expect(failure.detail).not.toContain("PRIVATE_ENV_KEY");
  });
  it("rejects invented rows rather than silently omitting requirements from the comparison", () => {
    expect(() =>
      parsePublicRoleFit(
        {
          summary: "Data role",
          matches: [
            valid,
            { ...valid, area: "Leadership", sources: ["invented-private-source"] },
            { ...valid, area: "Security", requirements: ["Hold security clearance"] }
          ]
        },
        "Build pipelines",
        context
      )
    ).toThrow("ROLE_FIT_UNGROUNDED_OUTPUT");
  });

  it("rejects a fabricated comparison instead of showing a successful result", () => {
    expect(() =>
      parsePublicRoleFit(
        { summary: "Great fit", matches: [{ ...valid, sources: ["made-up"] }] },
        "Build pipelines",
        context
      )
    ).toThrow("ROLE_FIT_UNGROUNDED_OUTPUT");
  });

  it("deduplicates themes and citations", () => {
    const result = parsePublicRoleFit(
      {
        summary: "Data role",
        matches: [
          { ...valid, sources: ["published-pipeline", "published-pipeline"] },
          { ...valid, area: "DATA PIPELINES" }
        ]
      },
      "Build   pipelines",
      context
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.sources).toHaveLength(1);
  });
});
