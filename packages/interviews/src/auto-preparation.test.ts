import { describe, expect, it } from "vitest";
import { generateInterviewKit } from "./auto-preparation";

describe("bounded interview preparation", () => {
  it("derives confidence-labelled questions and maps only supplied evidence", () => {
    const kit = generateInterviewKit({
      jobTitle: "Senior Data Engineer",
      company: "Example",
      description: "The role requires data platforms, reliability, and system design.",
      stage: { id: "stage", name: "Technical interview", stageType: "technical" },
      evidence: [
        {
          id: "fact-1",
          statement: "Built reliable data platforms with Python and SQL.",
          structuredValue: { technologies: ["Python", "SQL"] }
        }
      ]
    });
    expect(kit.questions[0]?.probability).toBe("high");
    expect(kit.questions.some((question) => question.evidence?.factId === "fact-1")).toBe(true);
    expect(
      kit.questions.some((question) => question.answer.includes("Built reliable data platforms"))
    ).toBe(true);
    expect(kit.limitations.join(" ")).toContain("not a guarantee");
  });

  it("surfaces evidence gaps instead of fabricating achievements", () => {
    const kit = generateInterviewKit({
      jobTitle: "Platform Engineer",
      company: "Example",
      description: "Experience with Kubernetes and incident response.",
      stage: { id: "stage", name: "System design", stageType: "system_design" },
      evidence: []
    });
    expect(kit.weakAreas.length).toBeGreaterThan(0);
    expect(kit.questions.every((question) => question.evidence === null)).toBe(true);
    expect(kit.questions.every((question) => question.answer.includes("No grounded answer"))).toBe(
      true
    );
  });
});
