import { describe, expect, it } from "vitest";
import {
  expandTechnologyLabels,
  expandTechnologyTerms,
  normalizeCareerIdentity,
  projectCareerPlacement,
  projectContributionLabel,
  sameCareerIdentity
} from "./portfolio-career-rules";

describe("portfolio career rules", () => {
  it("keeps the user-confirmed Bloom role and dates stable", () => {
    expect(
      normalizeCareerIdentity(
        "Technical Team Lead / Lead Software Engineer",
        "Bloom Institute of Technology",
        "2019-Apr 2020"
      )
    ).toEqual({
      role: "Lead Software Engineer",
      organization: "Bloom Institute of Technology",
      period: "November 2019 – April 2020"
    });
  });

  it("places user-confirmed projects under their correct roles", () => {
    expect(projectCareerPlacement("Lambdadoor")).toEqual({
      role: "Lead Software Engineer",
      organization: "Bloom Institute of Technology"
    });
    expect(projectCareerPlacement("Climate Change")).toEqual({
      role: "Data Engineer",
      organization: "One Acre Fund"
    });
    expect(projectCareerPlacement("ClimateChange")).toEqual({
      role: "Data Engineer",
      organization: "One Acre Fund"
    });
    expect(projectCareerPlacement("WhereToCode")).toEqual({
      role: "Software Engineer",
      organization: "Andela"
    });
    const lambdadoorPlacement = projectCareerPlacement("Lambdadoor");
    expect(lambdadoorPlacement).not.toBeNull();
    expect(
      sameCareerIdentity(lambdadoorPlacement ?? { role: "", organization: "" }, {
        role: "Lead Software Engineer",
        organization: "Bloom Institute of Technology"
      })
    ).toBe(true);
  });

  it("labels team projects as contributor work", () => {
    expect(projectContributionLabel("Wheretocode")).toBe("Contributor");
    expect(projectContributionLabel("Lambdadoor")).toBe("Contributor");
    expect(projectContributionLabel("Matrades")).toBeNull();
  });

  it("expands the full-stack acronym into explicit technologies", () => {
    expect(expandTechnologyLabels(["PERN"])).toEqual([
      "PostgreSQL",
      "Express.js",
      "React.js",
      "Node.js"
    ]);
    expect(expandTechnologyTerms("Built a PERN-stack application.")).toBe(
      "Built a PostgreSQL, Express.js, React.js, and Node.js application."
    );
  });
});
