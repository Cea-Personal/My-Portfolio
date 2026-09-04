import { describe, expect, it } from "vitest";
import { evaluateJobEligibility } from "./eligibility-filter";

const job = {
  company: "Example",
  title: "Senior Data Engineer",
  location: "Remote — EMEA",
  description: "Build reliable data platforms with Python, SQL, dbt and Airflow."
};

describe("deterministic job eligibility", () => {
  it("fails explicit exclusions before semantic scoring", () => {
    expect(evaluateJobEligibility(job, { excludedCompanies: ["Example"] })).toMatchObject({
      outcome: "FAIL",
      reasons: [expect.objectContaining({ code: "EXCLUDED_COMPANY" })]
    });
  });

  it("marks missing required evidence for review instead of inventing a match", () => {
    expect(evaluateJobEligibility(job, { requiredTechnologies: ["Spark"] })).toMatchObject({
      outcome: "REVIEW",
      reasons: [expect.objectContaining({ code: "REQUIRED_TECHNOLOGY_UNCONFIRMED" })]
    });
  });

  it("passes a role that satisfies the explicit criteria", () => {
    expect(
      evaluateJobEligibility(job, {
        targetTitles: ["Data Engineer"],
        locations: ["EMEA"],
        requiredTechnologies: ["Python", "SQL"]
      })
    ).toEqual({ outcome: "PASS", reasons: [] });
  });
});
