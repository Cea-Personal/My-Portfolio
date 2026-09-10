import { describe, expect, it } from "vitest";
import {
  hasMeaningfulCareerBrainContent,
  normalizeCareerBrainContent
} from "./career-brain-synthesis";

describe("Career Brain synthesis", () => {
  it("creates stable structured records and removes unsupported values", () => {
    const content = normalizeCareerBrainContent({
      cvSummary: "Profile",
      experiences: [{ organization: "Example", role: "Data Engineer", achievements: ["42%", 4] }],
      projects: [
        {
          title: "Career OS",
          category: "Software",
          summary: "A private evidence and portfolio system.",
          role: "Lead builder",
          outcome: "Made career evidence reusable.",
          process: ["Model evidence", "Retrieve relevant context"],
          technologies: ["TypeScript"]
        }
      ],
      education: [{ qualification: "MSc", institution: "Example University" }],
      certifications: [{ name: "Cloud", issuer: "Example" }],
      technicalSkills: [{ category: "Data", skills: ["SQL", null] }]
    });
    expect(content.experiences[0]).toMatchObject({
      organization: "Example",
      role: "Data Engineer",
      experience: ["42%"]
    });
    expect(content.experiences[0]?.id).toMatch(/^experience:/);
    expect(content.projects[0]).toMatchObject({
      category: "Software",
      summary: "A private evidence and portfolio system.",
      role: "Lead builder",
      outcome: "Made career evidence reusable.",
      process: ["Model evidence", "Retrieve relevant context"]
    });
    expect(content.technicalSkills[0]?.skills).toEqual(["SQL"]);
  });

  it("merges duplicate CV roles into one detailed experience list", () => {
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
          responsibilities: ["Built pipelines", "Partnered with analysts", "Documented contracts"],
          achievements: ["Improved trust", "Enabled reporting", "Improved deployment"],
          outcomes: ["Reduced operating cost"]
        }
      ]
    });
    expect(content.experiences).toHaveLength(1);
    const role = content.experiences[0];
    const points = Array.isArray(role?.experience)
      ? role.experience.filter((entry): entry is string => typeof entry === "string")
      : [];
    expect(points).toHaveLength(10);
    expect(new Set(points.map((point) => point.toLowerCase())).size).toBe(10);
  });

  it("rejects empty or placeholder-only snapshots", () => {
    const empty = normalizeCareerBrainContent({});
    const useful = normalizeCareerBrainContent({
      experiences: [{ organization: "Acme", role: "Data Engineer" }]
    });
    expect(hasMeaningfulCareerBrainContent(empty)).toBe(false);
    expect(hasMeaningfulCareerBrainContent(useful)).toBe(true);
  });

  it("gives skill groups distinct ids when their categories differ", () => {
    const content = normalizeCareerBrainContent({
      technicalSkills: [
        { category: "Data", skills: ["SQL"] },
        { category: "Platform", skills: ["Kubernetes"] }
      ]
    });
    expect(new Set(content.technicalSkills.map((item) => item.id)).size).toBe(2);
  });
});
