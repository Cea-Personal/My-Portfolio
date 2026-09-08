import { describe, expect, it } from "vitest";
import { normalizeCareerBrainContent } from "./career-brain-synthesis";

describe("Career Brain synthesis", () => {
  it("creates stable structured records and removes unsupported values", () => {
    const content = normalizeCareerBrainContent({
      cvSummary: "Profile",
      experiences: [{ organization: "Example", role: "Data Engineer", achievements: ["42%", 4] }],
      projects: [{ title: "Career OS", technologies: ["TypeScript"] }],
      education: [{ qualification: "MSc", institution: "Example University" }],
      certifications: [{ name: "Cloud", issuer: "Example" }],
      technicalSkills: [{ category: "Data", skills: ["SQL", null] }]
    });
    expect(content.experiences[0]).toMatchObject({
      organization: "Example",
      role: "Data Engineer",
      achievements: ["42%"]
    });
    expect(content.experiences[0]?.id).toMatch(/^experience:/);
    expect(content.technicalSkills[0]?.skills).toEqual(["SQL"]);
  });

  it("merges duplicate CV roles and keeps the strongest seven role points", () => {
    const content = normalizeCareerBrainContent({
      experiences: [
        {
          organization: "Acme",
          role: "Data Engineer",
          period: "2021-2023",
          responsibilities: ["Built pipelines", "Owned Airflow", "Maintained quality"],
          achievements: ["Cut runtime by 40%", "Built pipelines"],
          impact: ["Reduced incidents", "Improved trust"]
        },
        {
          organization: "ACME",
          role: "Data Engineer",
          period: "2021-2023",
          responsibilities: ["Built pipelines", "Partnered with analysts"],
          achievements: ["Improved trust", "Enabled reporting"]
        }
      ]
    });
    expect(content.experiences).toHaveLength(1);
    const role = content.experiences[0];
    const points = [role?.responsibilities, role?.achievements, role?.impact].flatMap((value) =>
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : []
    );
    expect(points).toHaveLength(7);
    expect(new Set(points.map((point) => point.toLowerCase())).size).toBe(7);
  });
});
