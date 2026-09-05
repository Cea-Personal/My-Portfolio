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

  it("filters out a listing that has content but misses a required technology", () => {
    expect(evaluateJobEligibility(job, { requiredTechnologies: ["Spark"] })).toMatchObject({
      outcome: "FAIL",
      reasons: [expect.objectContaining({ code: "REQUIRED_TECHNOLOGY_NOT_FOUND" })]
    });
  });

  it("filters title and location mismatches before they reach the opportunity list", () => {
    expect(
      evaluateJobEligibility(job, {
        targetTitles: ["Frontend Engineer"],
        locations: ["Berlin"]
      })
    ).toMatchObject({
      outcome: "FAIL",
      reasons: [
        expect.objectContaining({ code: "TITLE_NOT_MATCHED" }),
        expect.objectContaining({ code: "LOCATION_NOT_MATCHED" })
      ]
    });
  });

  it("keeps a description-less listing reviewable when a requirement cannot be verified", () => {
    expect(
      evaluateJobEligibility(
        { company: "Example", title: "Data Engineer", location: "Remote" },
        { targetTitles: ["Data Engineer"], locations: ["Remote"], requiredTechnologies: ["Spark"] }
      )
    ).toMatchObject({
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
