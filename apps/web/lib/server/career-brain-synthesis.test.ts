import { describe, expect, it } from "vitest";
import {
  compactSourceAwareExtractedFacts,
  hasMeaningfulCareerBrainContent,
  mergeCareerBrainSectionOutputs,
  mergeSourceAwareEvidence,
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
          projectType: "Personal",
          category: "Software",
          summary: "A private evidence and portfolio system.",
          role: "Lead builder",
          outcome: "Made career evidence reusable.",
          process: ["Model evidence", "Retrieve relevant context"],
          technologies: ["TypeScript"],
          links: ["https://github.com/example/career-os", "https://www.youtube.com/watch?v=abc123"]
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
      projectType: "personal",
      summary: "A private evidence and portfolio system.",
      role: "Lead builder",
      outcome: "Made career evidence reusable.",
      process: ["Model evidence", "Retrieve relevant context"],
      githubUrl: "https://github.com/example/career-os",
      videoUrl: "https://www.youtube.com/watch?v=abc123"
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
          impact: ["Reduced incidents", "Improved trust"],
          workProjects: [
            {
              title: "Pipeline platform",
              summary: "Built shared ingestion pipelines.",
              technologies: ["Airflow"]
            }
          ]
        },
        {
          organization: "ACME",
          role: "Data Engineer",
          period: "2021-2023",
          responsibilities: ["Built pipelines", "Partnered with analysts", "Documented contracts"],
          achievements: ["Improved trust", "Enabled reporting", "Improved deployment"],
          outcomes: ["Reduced operating cost"],
          workProjects: [
            {
              title: "Pipeline Platform",
              outcome: "Reduced onboarding time.",
              technologies: ["Python"]
            }
          ]
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
    expect(role?.workProjects).toEqual([
      {
        title: "Pipeline Platform",
        summary: "Built shared ingestion pipelines.",
        outcome: "Reduced onboarding time.",
        technologies: ["Airflow", "Python"],
        evidence: []
      }
    ]);
  });

  it("excludes the explicitly unwanted One Acre Fund backend role", () => {
    const content = normalizeCareerBrainContent({
      experiences: [
        {
          organization: "One Acre Fund",
          role: "Software Engineer (Backend)",
          summary: "Exclude me"
        },
        { organization: "One Acre Fund", role: "Senior Data Engineer", summary: "Keep me" }
      ]
    });
    expect(content.experiences.map((item) => item.role)).toEqual(["Senior Data Engineer"]);
  });

  it("normalizes Bloom and keeps confirmed projects with their actual roles", () => {
    const content = normalizeCareerBrainContent({
      experiences: [
        {
          organization: "Bloom Institute of Technology",
          role: "Technical Team Lead / Lead Software Engineer",
          period: "2019-Apr 2020"
        },
        { organization: "One Acre Fund", role: "Data Engineer", period: "2021-2022" },
        { organization: "Andela", role: "Software Engineer", period: "2018-2019" }
      ],
      projects: [
        {
          title: "Lambdadoor",
          projectType: "Personal",
          summary: "A feedback product.",
          technologies: ["PostgreSQL", "Express.js", "React.js", "Node.js"]
        },
        {
          title: "Climate Change",
          projectType: "Personal",
          summary: "A data project.",
          technologies: ["Airflow"]
        },
        {
          title: "WhereToCode",
          projectType: "Personal",
          summary: "A professional software project.",
          technologies: ["React"]
        }
      ]
    });
    const bloom = content.experiences.find(
      (item) => item.organization === "Bloom Institute of Technology"
    );
    const dataEngineer = content.experiences.find(
      (item) => item.organization === "One Acre Fund" && item.role === "Data Engineer"
    );
    const andela = content.experiences.find((item) => item.organization === "Andela");
    expect(bloom).toMatchObject({
      role: "Lead Software Engineer",
      period: "November 2019 – April 2020",
      projects: ["Lambdadoor"]
    });
    expect(dataEngineer?.projects).toEqual(["Climate Change"]);
    expect(andela?.projects).toEqual(["WhereToCode"]);
    expect(content.projects.map((item) => item.projectType)).toEqual([
      "professional",
      "professional",
      "professional"
    ]);
    expect(content.projects.find((item) => item.title === "Lambdadoor")?.technologies).toEqual([
      "PostgreSQL",
      "Express.js",
      "React.js",
      "Node.js"
    ]);
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

  it("keeps recent CV facts represented and excludes cover-letter wording", () => {
    const olderFacts = Array.from({ length: 20 }, (_, index) => ({
      id: `old-${String(index)}`,
      statement: `Older fact ${String(index)}`,
      sourceId: "old-cv",
      sourceName: "Older CV",
      documentKind: "resume",
      sourceCreatedAt: "2025-01-01T00:00:00.000Z"
    }));
    const result = compactSourceAwareExtractedFacts([
      ...olderFacts,
      {
        id: "cover-1",
        statement: "Tailored employer motivation",
        sourceId: "cover-letter",
        sourceName: "Cover letter",
        documentKind: "cover_letter",
        sourceCreatedAt: "2026-09-10T00:00:00.000Z"
      },
      {
        id: "new-1",
        statement: "Built a new production data pipeline",
        sourceId: "new-cv",
        sourceName: "Newest CV",
        documentKind: "resume",
        sourceCreatedAt: "2026-09-09T00:00:00.000Z"
      }
    ]);
    expect(result.some((item) => item.sourceName === "Newest CV")).toBe(true);
    expect(result.some((item) => item.documentKind === "cover_letter")).toBe(false);
  });

  it("reserves retrieval slots for recent source coverage before semantic matches", () => {
    const merged = mergeSourceAwareEvidence(
      [
        { id: "new-a-1", sourceId: "new-a", content: "New A one" },
        { id: "new-a-2", sourceId: "new-a", content: "New A two" },
        { id: "new-b-1", sourceId: "new-b", content: "New B one" }
      ],
      Array.from({ length: 10 }, (_, index) => ({
        id: `semantic-${String(index)}`,
        sourceId: "older",
        content: `Semantic ${String(index)}`
      })),
      { maxSources: 2, perSource: 2, limit: 5 }
    );
    expect(merged.map((item) => item.id)).toEqual([
      "new-a-1",
      "new-a-2",
      "new-b-1",
      "semantic-0",
      "semantic-1"
    ]);
  });

  it("merges the three focused synthesis results into one normalized snapshot", () => {
    const content = mergeCareerBrainSectionOutputs(
      {
        cvSummary: "Data engineer",
        portfolioSummary: "I build dependable data products.",
        about: "I work across data, software and AI.",
        technicalSkills: [{ category: "Data", skills: ["SQL"] }]
      },
      {
        experiences: [{ organization: "Acme", role: "Data Engineer", experience: ["Built ETL"] }]
      },
      {
        projects: [{ title: "Pipeline Lab", category: "Data engineering", summary: "ETL lab" }]
      }
    );
    expect(content.cvSummary).toBe("Data engineer");
    expect(content.experiences[0]?.role).toBe("Data Engineer");
    expect(content.projects[0]?.title).toBe("Pipeline Lab");
    expect(content.technicalSkills[0]?.skills).toEqual(["SQL"]);
  });
});
