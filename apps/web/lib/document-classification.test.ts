import { describe, expect, it } from "vitest";
import { classifyCareerDocument } from "./document-classification";

describe("classifyCareerDocument", () => {
  it("detects cover letters from filenames and conventional wording", () => {
    expect(
      classifyCareerDocument(
        "Scalable Cover.pdf",
        "Dear Hiring Manager, I am writing to apply for the position. Kind regards, Basil"
      ).kind
    ).toBe("cover_letter");
    expect(
      classifyCareerDocument(
        "application.pdf",
        "Dear HR, I am excited to apply for the role. Yours sincerely, Basil"
      ).kind
    ).toBe("cover_letter");
  });

  it("detects CVs from their filename or section structure", () => {
    expect(classifyCareerDocument("Basil Ogbonna CV.pdf", "Professional Experience").kind).toBe(
      "resume"
    );
    expect(
      classifyCareerDocument(
        "profile.pdf",
        "Professional Experience\nSenior Data Engineer\nTechnical Skills\nPython\nEducation"
      ).kind
    ).toBe("resume");
  });

  it("does not guess when there are no decisive signals", () => {
    expect(classifyCareerDocument("notes.pdf", "Architecture notes for a data platform").kind).toBe(
      "other"
    );
  });
});
