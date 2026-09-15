import { describe, expect, it } from "vitest";
import { publicPortfolioItemContext } from "./public-assistant-context";

describe("public portfolio assistant context", () => {
  it("aggregates approved structured role and project detail", () => {
    const context = publicPortfolioItemContext({
      title: "Data Engineer",
      company_name: "Example",
      public_summary: "Built dependable data products.",
      structured_content: {
        experience: ["Designed an Airflow ingestion platform."],
        responsibilities: ["Owned the production data pipeline."],
        achievements: ["Reduced manual reporting effort."],
        outcomes: ["Reporting became repeatable for the team."],
        workProjects: [
          {
            title: "Climate Change",
            outcome: "Made reporting repeatable.",
            technologies: ["Airflow", "Python"]
          }
        ],
        privateNote: "must not be exposed"
      }
    });
    expect(context).toContain("Designed an Airflow ingestion platform.");
    expect(context).toContain("Owned the production data pipeline.");
    expect(context).toContain("Reduced manual reporting effort.");
    expect(context).toContain("Reporting became repeatable for the team.");
    expect(context).toContain("Climate Change");
    expect(context).toContain("Made reporting repeatable.");
    expect(context).not.toContain("must not be exposed");
  });
});
