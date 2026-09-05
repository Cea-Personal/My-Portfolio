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
});
